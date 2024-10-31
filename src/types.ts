export interface JWK {
  kty: string;
  crv: string;
  x: string;
  y: string;
  d?: string;
  kid?: string;
  use?: string;
  alg?: string;
  key_ops?: string[];
}

export interface OAuthClientOptions {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  jwkPrivate: JWK;
  jwkPublic: JWK;
}

export interface TokenResponse {to
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

export interface TokenData {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
}

export interface TokenStorage {
  saveTokens(userId: string, tokenData: TokenData): Promise<void>;
  loadTokens(userId: string): Promise<TokenData | null>;
  deleteTokens(userId: string): Promise<void>;
}

export interface UserProfile {
  id: string;
  name: string;
  handle: string;
}

export interface ClientMetadata {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope: string;
  token_endpoint_auth_method: string;
  jwks_uri: string;
  application_type?: string;
  logo_uri?: string;
  policy_uri?: string;
}
