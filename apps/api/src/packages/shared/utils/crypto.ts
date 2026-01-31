// Cryptographic utilities for request signing and verification

import { createHmac, randomBytes } from 'crypto';

/**
 * Generate a random nonce for request signing
 */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generate a random API key
 */
export function generateApiKey(): string {
  return `spk_${randomBytes(24).toString('hex')}`;
}

/**
 * Generate a random API secret
 */
export function generateApiSecret(): string {
  return `sps_${randomBytes(32).toString('hex')}`;
}

/**
 * Generate a unique order ID
 */
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString('hex');
  return `ord_${timestamp}${random}`;
}

/**
 * Generate a unique merchant ID
 */
export function generateMerchantId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(6).toString('hex');
  return `mch_${timestamp}${random}`;
}

/**
 * Create HMAC-SHA256 signature for request authentication
 * 
 * Signature format: HMAC-SHA256(timestamp + nonce + body, secret)
 */
export function createSignature(
  timestamp: string,
  nonce: string,
  body: string,
  secret: string
): string {
  const payload = `${timestamp}${nonce}${body}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify HMAC-SHA256 signature
 */
export function verifySignature(
  timestamp: string,
  nonce: string,
  body: string,
  secret: string,
  signature: string
): boolean {
  const expectedSignature = createSignature(timestamp, nonce, body, secret);
  
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Check if timestamp is within acceptable range
 */
export function isTimestampValid(timestamp: string, maxAgeSeconds: number): boolean {
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime)) {
    return false;
  }
  
  const now = Math.floor(Date.now() / 1000);
  const age = now - requestTime;
  
  // Allow some clock skew (both past and future)
  return age >= -60 && age <= maxAgeSeconds;
}

/**
 * Hash a value for storage (e.g., nonces)
 * Uses environment variable for salt, with fallback to a default
 */
export function hashValue(value: string): string {
  const salt = process.env.NONCE_HASH_SALT || 'safepay-nonce-salt-default-v1';
  return createHmac('sha256', salt).update(value).digest('hex');
}
