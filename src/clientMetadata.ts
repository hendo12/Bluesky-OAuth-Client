// src/clientMetadata.ts
import { JWKS } from 'jose';

interface ClientMetadataOptions {
  clientName: string;
  redirectUris: string[];
  scopes?: string[];
  jwksUri: string;
}

export function generateClientMetadata(options: ClientMetadataOptions): object {
  return {
    client_id: options.jwksUri, // Typically, client_id is a URL pointing to client-metadata.json itself
    client_name: options.clientName,
    redirect_uris: options.redirectUris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    scope: options.scopes ? options.scopes.join(' ') : "openid profile",
    token_endpoint_auth_method: "none",
    jwks_uri: options.jwksUri
  };
}
