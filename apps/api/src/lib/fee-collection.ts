/**
 * Fee Collection Service
 * 
 * Handles the 1% platform fee on all transactions.
 * 
 * Two modes of operation:
 * 1. SPLITTER_CONTRACT: Payments go to smart contract that auto-splits
 * 2. TRACKING_ONLY: Fees are tracked for manual/batch collection
 */

import { 
  FEE_WALLET_ADDRESS, 
  PLATFORM_FEE_PERCENT,
  SPLITTER_CONTRACTS,
  STABLECOIN_ADDRESSES 
} from '@/packages/shared/constants';

export interface FeeRecord {
  orderId: string;
  merchantId: string;
  merchantAddress: string;
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
  currency: string;
  network: string;
  status: 'pending' | 'collected' | 'failed';
  txHash?: string;
  createdAt: string;
  collectedAt?: string;
}

// In-memory fee tracking (use database in production)
const feeRecords: FeeRecord[] = [];

/**
 * Calculate fee split for a transaction
 */
export function calculateFeeSplit(grossAmount: number): {
  merchantAmount: number;
  feeAmount: number;
  feePercent: number;
} {
  const feeAmount = grossAmount * PLATFORM_FEE_PERCENT;
  const merchantAmount = grossAmount - feeAmount;
  
  return {
    merchantAmount: Math.floor(merchantAmount * 1e6) / 1e6, // 6 decimal precision
    feeAmount: Math.floor(feeAmount * 1e6) / 1e6,
    feePercent: PLATFORM_FEE_PERCENT * 100,
  };
}

/**
 * Get the appropriate receiving address for a payment
 * If splitter contract is deployed, use that; otherwise use merchant address
 */
export function getReceivingAddress(
  merchantAddress: string,
  network: string
): {
  address: string;
  useSplitter: boolean;
  splitterContract?: string;
} {
  const splitterAddress = SPLITTER_CONTRACTS[network.toUpperCase()];
  
  if (splitterAddress && splitterAddress.length > 0) {
    return {
      address: splitterAddress,
      useSplitter: true,
      splitterContract: splitterAddress,
    };
  }
  
  // No splitter deployed - send directly to merchant
  // Fee will be tracked and collected separately
  return {
    address: merchantAddress,
    useSplitter: false,
  };
}

/**
 * Record a fee for tracking
 */
export function recordFee(params: {
  orderId: string;
  merchantId: string;
  merchantAddress: string;
  grossAmount: number;
  currency: string;
  network: string;
}): FeeRecord {
  const { merchantAmount, feeAmount } = calculateFeeSplit(params.grossAmount);
  
  const record: FeeRecord = {
    orderId: params.orderId,
    merchantId: params.merchantId,
    merchantAddress: params.merchantAddress,
    grossAmount: params.grossAmount,
    netAmount: merchantAmount,
    feeAmount,
    currency: params.currency,
    network: params.network,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  
  feeRecords.push(record);
  return record;
}

/**
 * Mark fee as collected
 */
export function markFeeCollected(orderId: string, txHash: string): boolean {
  const record = feeRecords.find(r => r.orderId === orderId);
  if (record) {
    record.status = 'collected';
    record.txHash = txHash;
    record.collectedAt = new Date().toISOString();
    return true;
  }
  return false;
}

/**
 * Get pending fees for collection
 */
export function getPendingFees(): FeeRecord[] {
  return feeRecords.filter(r => r.status === 'pending');
}

/**
 * Get total fees by status
 */
export function getFeeSummary(): {
  totalPending: number;
  totalCollected: number;
  pendingCount: number;
  collectedCount: number;
} {
  const pending = feeRecords.filter(r => r.status === 'pending');
  const collected = feeRecords.filter(r => r.status === 'collected');
  
  return {
    totalPending: pending.reduce((sum, r) => sum + r.feeAmount, 0),
    totalCollected: collected.reduce((sum, r) => sum + r.feeAmount, 0),
    pendingCount: pending.length,
    collectedCount: collected.length,
  };
}

/**
 * Get all fee records
 */
export function getAllFeeRecords(): FeeRecord[] {
  return [...feeRecords];
}

/**
 * Fee wallet configuration
 */
export const FEE_CONFIG = {
  walletAddress: FEE_WALLET_ADDRESS,
  feePercent: PLATFORM_FEE_PERCENT * 100,
  feeBasisPoints: Math.round(PLATFORM_FEE_PERCENT * 10000),
};

/**
 * Check if a network has a deployed splitter contract
 */
export function hasSplitterContract(network: string): boolean {
  const address = SPLITTER_CONTRACTS[network.toUpperCase()];
  return !!address && address.length > 0;
}

/**
 * Get stablecoin address for a network
 */
export function getStablecoinAddress(network: string, currency: string): string | null {
  const networkAddresses = STABLECOIN_ADDRESSES[network.toUpperCase()];
  if (!networkAddresses) return null;
  return networkAddresses[currency.toUpperCase()] || null;
}
