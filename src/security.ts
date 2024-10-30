import dns from 'dns/promises';
import { isIP } from 'net';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { RateLimitOptions } from './types';
import { checkRateLimit } from './rateLimiter';

const ALLOWED_HOSTS = ['bsky.social'];

/**
 * Validates a URL to ensure it meets security requirements.
 * @param url - The URL string to validate.
 * @returns A promise that resolves to true if valid, false otherwise.
 */
export async function isValidUrl(url: string): Promise<boolean> {
  try {
    const parsedUrl = new URL(url);

    // 1. Restrict protocols to HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }

    // 2. Check if hostname is in the allowed list
    if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
      return false;
    }

    // 3. Resolve the hostname to prevent SSRF
    const addresses = await dns.lookup(parsedUrl.hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if the given IP address is private.
 * Supports both IPv4 and IPv6.
 * @param ip - The IP address to check.
 * @returns True if the IP is private, false otherwise.
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  const privateRanges = [
    { start: '10.0.0.0', end: '10.255.255.255' },
    { start: '172.16.0.0', end: '172.31.255.255' },
    { start: '192.168.0.0', end: '192.168.255.255' },
    { start: '127.0.0.0', end: '127.255.255.255' }, // Loopback
    { start: '0.0.0.0', end: '0.255.255.255' },     // "This" network
  ];

  if (isIP(ip) === 4) {
    const ipNum = ipToNumber(ip);
    for (const range of privateRanges) {
      const start = ipToNumber(range.start);
      const end = ipToNumber(range.end);
      if (ipNum >= start && ipNum <= end) {
        return true;
      }
    }
  } else if (isIP(ip) === 6) {
    // IPv6 private addresses (Unique Local Addresses)
    if (ip.startsWith('fd') || ip.startsWith('fe80')) {
      return true;
    }
  }

  return false;
}

/**
 * Converts an IPv4 address to a number for easy comparison.
 * @param ip - The IPv4 address.
 * @returns The numerical representation of the IP.
 */
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Sanitizes a string by escaping potentially dangerous characters.
 * @param input - The input string to sanitize.
 * @returns The sanitized string.
 */
export function sanitizeString(input: string): string {
  return input.replace(/[<>&'"]/g, (char) => {
    const escapeMap: { [key: string]: string } = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return escapeMap[char] || char;
  });
}

/**
 * Validates whether a string is a well-formed JWT.
 * @param token - The JWT string to validate.
 * @returns True if valid, false otherwise.
 */
export function isValidJWT(token: string): boolean {
  try {
    // Decode without verifying signature
    jwt.decode(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically secure CSRF token.
 * @returns A CSRF token string.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verifies a CSRF token.
 * @param token - The token to verify.
 * @param sessionToken - The token stored in the user's session.
 * @returns True if tokens match, false otherwise.
 */
export function verifyCsrfToken(token: string, sessionToken: string): boolean {
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(sessionToken));
}

/**
 * Checks if a particular key has exceeded the rate limit.
 * @param key - A unique identifier for the rate limit (e.g., IP address).
 * @param options - Rate limiting options.
 * @returns True if under the limit, false if exceeded.
 */


const rateLimitStore: { [key: string]: { count: number; firstRequest: number } } = {};

export function checkRateLimit(key: string, options: RateLimitOptions): boolean {
  const currentTime = Date.now();
  if (!rateLimitStore[key]) {
    rateLimitStore[key] = { count: 1, firstRequest: currentTime };
    return true;
  }

  const elapsedTime = currentTime - rateLimitStore[key].firstRequest;

  if (elapsedTime > options.windowMs) {
    // Reset the count and window
    rateLimitStore[key] = { count: 1, firstRequest: currentTime };
    return true;
  }

  if (rateLimitStore[key].count < options.maxRequests) {
    rateLimitStore[key].count += 1;
    return true;
  }

  // Rate limit exceeded
  return false;
}
