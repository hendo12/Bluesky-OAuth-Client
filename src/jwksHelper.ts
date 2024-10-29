import { generateKeyPair, exportJWK } from 'jose';

export async function generateJWKS(): Promise<{ jwks: { keys: any[] }, privateKey: any }> {
  const { publicKey, privateKey } = await generateKeyPair('ES256');

  const jwkPrivate = await exportJWK(privateKey);
  const jwkPublic = await exportJWK(publicKey);

  const jwks = { keys: [jwkPublic] };

  return { jwks, privateKey: jwkPrivate };
}
