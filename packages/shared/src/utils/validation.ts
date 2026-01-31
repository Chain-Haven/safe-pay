// Validation utilities

import { ADDRESS_PATTERNS, SETTLEMENT_OPTIONS } from '../constants';
import type { SettlementCurrency, SettlementNetwork } from '../types';

/**
 * Validate a cryptocurrency address for a given network
 */
export function validateAddress(address: string, network: string): boolean {
  const pattern = ADDRESS_PATTERNS[network];
  if (!pattern) {
    // Unknown network, do basic validation
    return address.length >= 20 && address.length <= 100;
  }
  return pattern.test(address);
}

/**
 * Validate settlement currency
 */
export function isValidSettlementCurrency(currency: string): currency is SettlementCurrency {
  return currency === 'USDC' || currency === 'USDT';
}

/**
 * Validate settlement network for a given currency
 */
export function isValidSettlementNetwork(
  currency: SettlementCurrency,
  network: string
): network is SettlementNetwork {
  const options = SETTLEMENT_OPTIONS[currency];
  return options.networks.includes(network as any);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate fiat amount (positive number with max 2 decimal places)
 */
export function isValidFiatAmount(amount: number): boolean {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return false;
  }
  if (amount <= 0 || amount > 1000000) {
    return false;
  }
  // Check decimal places
  const decimalPart = amount.toString().split('.')[1];
  return !decimalPart || decimalPart.length <= 2;
}

/**
 * Validate crypto amount (positive number with max 8 decimal places)
 */
export function isValidCryptoAmount(amount: number): boolean {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return false;
  }
  if (amount <= 0) {
    return false;
  }
  const decimalPart = amount.toString().split('.')[1];
  return !decimalPart || decimalPart.length <= 8;
}

/**
 * Validate external order ID format
 */
export function isValidExternalOrderId(orderId: string): boolean {
  if (typeof orderId !== 'string') {
    return false;
  }
  // Allow alphanumeric, hyphens, underscores, max 100 chars
  return /^[a-zA-Z0-9_-]{1,100}$/.test(orderId);
}

/**
 * Validate currency code format
 */
export function isValidCurrencyCode(code: string): boolean {
  if (typeof code !== 'string') {
    return false;
  }
  // 2-10 uppercase letters/numbers
  return /^[A-Z0-9]{2,10}$/.test(code.toUpperCase());
}

/**
 * Sanitize string input (remove potential XSS)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .trim()
    .slice(0, 1000);
}

/**
 * Validate request body has required fields
 */
export function validateRequiredFields<T extends object>(
  body: any,
  fields: (keyof T)[]
): body is T {
  if (!body || typeof body !== 'object') {
    return false;
  }
  return fields.every((field) => field in body && body[field] !== undefined);
}
