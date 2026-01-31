// Formatting utilities

import { PLATFORM_FEE_PERCENT } from '../constants';

/**
 * Round a number down to specified decimal places
 */
export function floorToDecimals(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.floor(value * multiplier) / multiplier;
}

/**
 * Round a number to specified decimal places
 */
export function roundToDecimals(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Calculate net receive amount after platform fee
 * 
 * gross_receive = fiat_amount (assuming 1:1 stablecoin rate)
 * net_receive = gross_receive × (1 - PLATFORM_FEE_PERCENT)
 * 
 * Rounded down to 6 decimals (USDC/USDT precision)
 */
export function calculateNetReceive(grossAmount: number): number {
  const netAmount = grossAmount * (1 - PLATFORM_FEE_PERCENT);
  return floorToDecimals(netAmount, 6);
}

/**
 * Calculate gross amount from net amount (reverse calculation)
 */
export function calculateGrossFromNet(netAmount: number): number {
  return roundToDecimals(netAmount / (1 - PLATFORM_FEE_PERCENT), 6);
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: string, decimals = 2): string {
  return `${amount.toFixed(decimals)} ${currency}`;
}

/**
 * Format crypto amount for display (adaptive decimals)
 */
export function formatCryptoAmount(amount: number): string {
  if (amount >= 1000) {
    return amount.toFixed(2);
  } else if (amount >= 1) {
    return amount.toFixed(4);
  } else if (amount >= 0.0001) {
    return amount.toFixed(6);
  } else {
    return amount.toFixed(8);
  }
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Get time remaining until expiration
 */
export function getTimeRemaining(expiresAt: string): { minutes: number; seconds: number; expired: boolean } {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const remaining = expiry - now;
  
  if (remaining <= 0) {
    return { minutes: 0, seconds: 0, expired: true };
  }
  
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  
  return { minutes, seconds, expired: false };
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars + 3) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Generate checkout URL
 */
export function generateCheckoutUrl(baseUrl: string, orderId: string): string {
  return `${baseUrl}/checkout/${orderId}`;
}
