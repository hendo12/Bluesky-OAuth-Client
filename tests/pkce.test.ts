import { generateCodeVerifier, generateCodeChallenge } from '../src/pkce';

test('generateCodeVerifier produces a string', () => {
  const verifier = generateCodeVerifier();
  expect(typeof verifier).toBe('string');
});

test('generateCodeChallenge produces a base64url string', () => {
  const verifier = 'testverifier';
  const challenge = generateCodeChallenge(verifier);
  expect(typeof challenge).toBe('string');
});
