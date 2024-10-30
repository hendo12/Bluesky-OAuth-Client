import crypto from 'crypto';

export function generateCodeVerifier(): string {
  try {
    return crypto.randomBytes(32).toString('base64url').slice(0, 128);
  } catch (error) {
    throw new Error(`Failed to generate code verifier: ${(error as Error).message}`);
  }
}

export function generateCodeChallenge(codeVerifier: string): string {
  try {
    return crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
  } catch (error) {
    throw new Error(`Failed to generate code challenge: ${(error as Error).message}`);
  }
}
