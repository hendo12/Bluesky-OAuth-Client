import Redis from 'ioredis';

const redis = new Redis();

export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<boolean> {
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.pexpire(key, options.windowMs);
  }
  return current <= options.maxRequests;
}
