// Request authentication and verification
import { NextRequest } from 'next/server';
import {
  verifySignature,
  isTimestampValid,
  MAX_REQUEST_AGE_SECONDS,
} from '@/packages/shared';
import { getMerchantByApiKey, isNonceUsed, recordNonce } from './database';
import type { DbMerchant } from './supabase';

export interface AuthResult {
  success: boolean;
  merchant?: DbMerchant;
  body?: string; // Body is returned since it was consumed during verification
  error?: string;
}

/**
 * Verify API request authentication
 * 
 * Required headers:
 * - X-API-Key: Merchant API key
 * - X-Timestamp: Unix timestamp (seconds)
 * - X-Nonce: Random unique value
 * - X-Signature: HMAC-SHA256(timestamp + nonce + body, api_secret)
 */
export async function verifyRequest(request: NextRequest): Promise<AuthResult> {
  try {
    // Extract headers
    const apiKey = request.headers.get('X-API-Key');
    const timestamp = request.headers.get('X-Timestamp');
    const nonce = request.headers.get('X-Nonce');
    const signature = request.headers.get('X-Signature');

    // Check required headers
    if (!apiKey || !timestamp || !nonce || !signature) {
      return {
        success: false,
        error: 'Missing required authentication headers',
      };
    }

    // Verify timestamp is recent
    if (!isTimestampValid(timestamp, MAX_REQUEST_AGE_SECONDS)) {
      return {
        success: false,
        error: 'Request timestamp expired or invalid',
      };
    }

    // Get merchant by API key
    const merchant = await getMerchantByApiKey(apiKey);
    if (!merchant) {
      return {
        success: false,
        error: 'Invalid API key',
      };
    }

    // Check nonce hasn't been used (replay protection)
    const nonceUsed = await isNonceUsed(nonce, merchant.id);
    if (nonceUsed) {
      return {
        success: false,
        error: 'Nonce already used (replay attack detected)',
      };
    }

    // Get request body
    const body = await request.text();

    // Verify signature
    const isValid = verifySignature(
      timestamp,
      nonce,
      body,
      merchant.api_secret,
      signature
    );

    if (!isValid) {
      return {
        success: false,
        error: 'Invalid signature',
      };
    }

    // Record nonce to prevent replay
    await recordNonce(nonce, merchant.id);

    return {
      success: true,
      merchant,
      body, // Return body since it was consumed
    };
  } catch (error: any) {
    console.error('Auth verification error:', error);
    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Parse JSON body from request after auth verification
 * Note: Body was already consumed by verifyRequest, so we need to re-read
 */
export async function parseAuthenticatedBody<T>(request: NextRequest): Promise<T> {
  const body = await request.text();
  return JSON.parse(body) as T;
}

/**
 * Create headers for authenticated responses
 */
export function createResponseHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}
