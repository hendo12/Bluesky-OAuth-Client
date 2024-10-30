import { SignJWT, KeyLike } from 'jose';
import { v4 as uuidv4 } from 'uuid';

export async function generateDpopProof(
  method: string,
  url: string,
  privateKey: KeyLike,
  jwkPublic: object
): Promise<string> {
  try {
    const jwt = await new SignJWT({
      htu: url,
      htm: method,
      jti: uuidv4(),
    })
      .setProtectedHeader({
        alg: 'ES256',
        typ: 'dpop+jwt',
        jwk: jwkPublic,
      })
      .setIssuedAt()
      .sign(privateKey);

    return jwt;
  } catch (error: any) {
    console.error('Error generating DPoP proof:', error);
    throw new DPopProofError('Failed to generate DPoP proof');
  }
}
