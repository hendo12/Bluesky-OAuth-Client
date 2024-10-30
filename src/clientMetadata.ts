import { JWKS } from 'jose';
import { ClientMetadata } from './types';

export function generateClientMetadata(options: ClientMetadata): object {
  return {
    client_id: `https://yourapp.com/oauth/client-metadata.json`, // TODO: Assign client_id to the URL where client-metadata.json is hosted.
    client_name: options.clientName,
    redirect_uris: options.redirectUris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    scope: options.scopes ? options.scopes.join(' ') : "openid profile",
    token_endpoint_auth_method: "none",
    jwks_uri: options.jwksUri,
    application_type: "web",
    logo_uri: options.logoUri || "",
    policy_uri: options.policyUri || ""
  };
}
