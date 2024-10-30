import { BlueskyOAuthClient } from '../src/oauth';
import { generateJWKS } from '../src/jwksHelper';

test('BlueskyOAuthClient initializes correctly', async () => {
  const { jwks, privateKey } = await generateJWKS();
  const oauthClient = new BlueskyOAuthClient({
    clientId: 'https://yourapp.com/oauth/client-metadata.json',
    redirectUri: 'https://yourapp.com/oauth/callback',
    jwkPrivate: privateKey,
    jwkPublic: jwks.keys[0],
  });
  expect(oauthClient).toBeDefined();
});