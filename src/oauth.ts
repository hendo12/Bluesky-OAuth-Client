import axios from 'axios';
import { generateCodeVerifier, generateCodeChallenge } from './pkce';
import { generateDpopProof } from './dpop';
import { JWK, TokenResponse, UserProfile, TokenData, TokenStorage } from './types';
import { OAuthClientError, OAuthAuthorizationError, OAuthServerError, OAuthTokenRequestError } from './errors';

export class BlueskyOAuthClient {
  private clientId: string;
  private redirectUri: string;
  private scopes: string[];
  private jwkPrivate: JWK;
  private jwkPublic: JWK;
  
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  private userId: string;
  private storage: TokenStorage;

  constructor(options: {
    clientId: string;
    redirectUri: string;
    scopes?: string[];
    jwkPrivate: JWK;
    jwkPublic: JWK;
    userId: string;
    storage: TokenStorage;
  }) {
    if (!options.clientId) {
      throw new OAuthClientError('clientId is required and should be the URL to client-metadata.json');
    }
    if (!options.redirectUri) {
      throw new OAuthClientError('redirectUri is required');
    }
    if (!options.jwkPrivate) {
      throw new OAuthClientError('jwkPrivate is required');
    }
    if (!options.jwkPublic) {
      throw new OAuthClientError('jwkPublic is required');
    }

    if (!options.storage) {
      throw new OAuthClientError('storage mechanism is required');
    }

    this.clientId = options.clientId;
    this.redirectUri = options.redirectUri;
    this.scopes = options.scopes || ['openid', 'profile'];
    this.jwkPrivate = options.jwkPrivate;
    this.jwkPublic = options.jwkPublic;
    this.userId = options.userId;
    this.storage = options.storage;

    this.loadTokens().catch((error) => {
      throw new OAuthTokenError(`Failed to load tokens`);
    })
  }

  /**
   * Generates the authorization URL and returns the code verifier.
   */
   async getAuthorizationUrl(): Promise<{ url: string; codeVerifier: string }> {
   const codeVerifier = generateCodeVerifier();
   const codeChallenge = generateCodeChallenge(codeVerifier);
   const requestUri = await this.pushAuthorizationRequest(codeChallenge);
   const authorizationUrl = `https://bsky.social/oauth/authorize?request_uri=${encodeURIComponent(
     requestUri
   )}`;
    return { url: authorizationUrl, codeVerifier };
  }

  /**
   * Pushes the authorization request to Bluesky's PAR endpoint.
   */
  private async pushAuthorizationRequest(codeChallenge: string): Promise<string> {
    const parEndpoint = 'https://bsky.social/oauth/par';

    const isParValid = await isValidUrl(parEndpoint);
    if (!isParValid) {
      throw new OAuthAuthorizationError('Invalid PAR endpoint URL.');
    }

    const data = {
      client_id: this.clientId,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      response_type: 'code',
    };

    try {
      const response = await axios.post(parEndpoint, data, {
        headers: { 'Content-Type': 'application/json' },
      });
      return response.data.request_uri;
    } catch (error: any) {
      throw new OAuthServerError(`Failed to push authorization request: ${error.message}`);
    }
  }

  private async storeTokens(tokenResponse: TokenResponse): Promise<void> {
    this.accessToken = tokenResponse.access_token;
    this.refreshToken = tokenResponse.refresh_token || null;
    this.tokenExpiresAt = tokenResponse.expires_in
      ? Date.now() + tokenResponse.expires_in * 1000
      : null;
  
    const tokenData: TokenData = {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      tokenExpiresAt: this.tokenExpiresAt,
    };

    await this.storage.saveTokens(this.userId, tokenData);
  }

  private async loadTokens(): Promise<void> {
    const tokenData = await this.storage.loadTokens(this.userId);
    if (tokenData) {
      this.accessToken = tokenData.accessToken;
      this.refreshToken = tokenData.refreshToken;
      this.tokenExpiresAt = tokenData.tokenExpiresAt;
    } else {
      // No tokens found, need to re-authenticate
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiresAt = null;
    }
  } 

  public async logout(): Promise<void> {
    // Perform any necessary cleanup, e.g., revoke tokens

    await this.storage.deleteTokens(this.userId);

    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Handles the OAuth callback by exchanging the authorization code for tokens.
   */
  async handleCallback(code: string, codeVerifier: string): Promise<TokenResponse> {
    const tokenEndpoint = 'https://bsky.social/oauth/token';
    const dpopProof = await generateDpopProof(
      'POST',
      tokenEndpoint,
      this.jwkPrivate,
      this.jwkPublic
    );
    const data = {
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      client_id: this.clientId,
    };

    try {
      const response = await axios.post(tokenEndpoint, data, {
        headers: {
          'Content-Type': 'application/json',
          DPoP: dpopProof,
        },
      });
      const tokenResponse = response.data;
      this.storeTokens(tokenResponse);
    } catch (error: any) {
      throw new OAuthTokenRequestError(`Failed to exchange token: ${error.message}`);
    }
  }

  private async refreshAccessToken(): Promise<void> {
    const tokenEndpoint = 'https://bsky.social/oauth/token';
    const dpopProof = await generateDpopProof(
      'POST',
      tokenEndpoint,
      this.jwkPrivate,
      this.jwkPublic
    );
  
    const data = {
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.clientId,
    };
  
    try {
      const response = await axios.post(tokenEndpoint, data, {
        headers: {
          'Content-Type': 'application/json',
          DPoP: dpopProof,
        },
      });
  
      const tokenResponse: TokenResponse = response.data;
  
      // Update stored tokens
      this.storeTokens(tokenResponse);
  
    } catch (error: any) {
      throw new OAuthTokenRequestError(`Failed to refresh access token: ${error.message}`);
    }
  }

  /**
   * Makes an authenticated request using the access token and DPoP proof.
   */
  async makeAuthenticatedRequest(
    method: string,
    url: string,
    accessToken: string,
    data?: any
  ): Promise<UserProfile> {
    if (!accessToken) {
      if (!this.accessToken) {
        throw new OAuthTokenError('Access token is missing.');
      }
  
      if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt) {
        if (this.refreshToken) {
          await this.refreshAccessToken();
        } else {
          throw new OAuthTokenError('Refresh token is missing.');
        }
      }
      accessToken = this.accessToken;
    }

    const dpopProof = await generateDpopProof(
      method,
      url,
      this.jwkPrivate,
      this.jwkPublic
    );
    const headers = {
      Authorization: `DPoP ${accessToken}`,
      DPoP: dpopProof,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.request({
        method,
        url,
        data,
        headers,
      });
      return response.data;
    } catch (error: any) {
      throw new OAuthServerError(`Failed to make authenticated request: ${error.message}`);
    }
  }
}
