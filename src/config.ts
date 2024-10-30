import dotenv from 'dotenv';

dotenv.config();

export const config = {
  clientId: process.env.BLUESKY_CLIENT_ID!,
  redirectUri: process.env.BLUESKY_REDIRECT_URI!,
  tokenEndpoint: process.env.BLUESKY_TOKEN_ENDPOINT || 'https://bsky.social/oauth/token',
  parEndpoint: process.env.BLUESKY_PAR_ENDPOINT || 'https://bsky.social/oauth/par',
};