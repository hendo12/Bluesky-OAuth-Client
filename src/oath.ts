// src/oauth.ts
import axios from 'axios';
import { generateCodeVerifier, generateCodeChallenge } from './pkce';
import { generateDpopProof } from './dpop';

export class BlueskyOAuthClient {
  private clientId: string;
  private redirectUri: string;
  private scopes: string[];
  private jwkPrivate: any;
  private jwkPublic: any;

  constructor(options: {
    clientId: string;
    redirectUri: string;
    scopes?: string[];
    jwkPrivate: any;
    jwkPublic: any;
  }) {
    if (!options.clientId) {
      throw new Error('clientId is required and should be the URL to client-metadata.json');
    }
    if (!options.redirectUri) {
      throw new Error('redirectUri is required');
    }
    if (!options.jwkPrivate) {
      throw new Error('jwkPrivate is required');
    }
    if (!options.jwkPublic) {
      throw new Error('jwkPublic is required');
    }

    this.clientId = options.clientId;
    this.redirectUri = options.redirectUri;
    this.scopes = options.scopes || ['openid', 'profile'];
    this.jwkPrivate = options.jwkPrivate;
    this.jwkPublic = options.jwkPublic;
  }

  /**
   * Generates the authorization URL and returns the code verifier.
   */
  async getAuthorizationUrl(): Promise<{ url: string; codeVerifier: string }> {
    const rateLimitOptions = { maxRequests: 10, windowMs: 60 * 1000 }; // 10 requests per minute

    // Check rate limit
    const underLimit = checkRateLimit(userKey, rateLimitOptions);
    if (!underLimit) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
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
      throw new Error('Invalid PAR endpoint URL.');
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
      throw new Error(`Failed to push authorization request: ${error.message}`);
    }
  }

  /**
   * Handles the OAuth callback by exchanging the authorization code for tokens.
   */
  async handleCallback(code: string, codeVerifier: string): Promise<any> {
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
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to exchange token: ${error.message}`);
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
  ): Promise<any> {
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
      throw new Error(`Failed to make authenticated request: ${error.message}`);
    }
  }
}
