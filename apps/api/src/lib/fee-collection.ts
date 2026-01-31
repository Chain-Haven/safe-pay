/**
 * Fee Collection Service
 * 
 * Handles the 1% platform fee on all transactions.
 * All fees are stored in the database for persistence.
 * 
 * Two modes of operation:
 * 1. SPLITTER_CONTRACT: Payments go to smart contract that auto-splits
 * 2. TRACKING_ONLY: Fees are tracked for manual/batch collection
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { 
  FEE_WALLET_ADDRESS, 
  PLATFORM_FEE_PERCENT,
  SPLITTER_CONTRACTS,
  STABLECOIN_ADDRESSES 
} from '@/packages/shared/constants';

export interface FeeRecord {
  id?: string;
  orderId: string;
  merchantId: string;
  merchantAddress: string;
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
  currency: string;
  network: string;
  status: 'pending' | 'collected' | 'failed';
  collectionMethod?: 'splitter_contract' | 'manual';
  collectionTxHash?: string;
  feeWallet: string;
  createdAt: string;
  collectedAt?: string;
}

// In-memory fallback for when database is not available
const memoryFeeRecords: FeeRecord[] = [];

/**
 * Calculate fee split for a transaction
 * Always: 99% to merchant, 1% to platform
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
 * If splitter contract is deployed for the network, use that
 * Otherwise use merchant address directly (fee tracked for manual collection)
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
 * Record a fee in the database
 * This is called for EVERY transaction regardless of collection method
 */
export async function recordFee(params: {
  orderId: string;
  merchantId: string;
  merchantAddress: string;
  grossAmount: number;
  currency: string;
  network: string;
}): Promise<FeeRecord> {
  const { merchantAmount, feeAmount } = calculateFeeSplit(params.grossAmount);
  const useSplitter = hasSplitterContract(params.network);
  
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
    collectionMethod: useSplitter ? 'splitter_contract' : 'manual',
    feeWallet: FEE_WALLET_ADDRESS,
    createdAt: new Date().toISOString(),
  };

  // Try to save to database
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('fees')
        .insert({
          order_id: record.orderId,
          merchant_id: record.merchantId,
          merchant_address: record.merchantAddress,
          gross_amount: record.grossAmount,
          net_amount: record.netAmount,
          fee_amount: record.feeAmount,
          currency: record.currency,
          network: record.network,
          status: record.status,
          collection_method: record.collectionMethod,
          fee_wallet: record.feeWallet,
        })
        .select()
        .single();

      if (error) {
        console.error('[FeeCollection] Database error:', error);
        // Fall back to memory
        memoryFeeRecords.push(record);
      } else if (data) {
        record.id = data.id;
      }
    } catch (err) {
      console.error('[FeeCollection] Failed to save fee:', err);
      memoryFeeRecords.push(record);
    }
  } else {
    // No database - use memory
    memoryFeeRecords.push(record);
  }
  
  console.log(`[FeeCollection] Fee recorded: $${feeAmount} from order ${params.orderId}`);
  console.log(`[FeeCollection] Merchant gets: $${merchantAmount} (99%), Platform gets: $${feeAmount} (1%)`);
  
  return record;
}

/**
 * Mark fee as collected (after splitter processes or manual collection)
 */
export async function markFeeCollected(orderId: string, txHash: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('fees')
        .update({
          status: 'collected',
          collection_tx_hash: txHash,
          collected_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);

      if (error) {
        console.error('[FeeCollection] Failed to mark collected:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[FeeCollection] Error:', err);
      return false;
    }
  }
  
  // Memory fallback
  const record = memoryFeeRecords.find(r => r.orderId === orderId);
  if (record) {
    record.status = 'collected';
    record.collectionTxHash = txHash;
    record.collectedAt = new Date().toISOString();
    return true;
  }
  return false;
}

/**
 * Get pending fees for collection
 */
export async function getPendingFees(): Promise<FeeRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('fees')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[FeeCollection] Error fetching pending:', error);
        return memoryFeeRecords.filter(r => r.status === 'pending');
      }

      return (data || []).map(d => ({
        id: d.id,
        orderId: d.order_id,
        merchantId: d.merchant_id,
        merchantAddress: d.merchant_address,
        grossAmount: d.gross_amount,
        netAmount: d.net_amount,
        feeAmount: d.fee_amount,
        currency: d.currency,
        network: d.network,
        status: d.status,
        collectionMethod: d.collection_method,
        collectionTxHash: d.collection_tx_hash,
        feeWallet: d.fee_wallet,
        createdAt: d.created_at,
        collectedAt: d.collected_at,
      }));
    } catch (err) {
      console.error('[FeeCollection] Error:', err);
    }
  }
  
  return memoryFeeRecords.filter(r => r.status === 'pending');
}

/**
 * Get fee summary statistics
 */
export async function getFeeSummary(): Promise<{
  totalPending: number;
  totalCollected: number;
  pendingCount: number;
  collectedCount: number;
}> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('fees')
        .select('status, fee_amount');

      if (!error && data) {
        const pending = data.filter(d => d.status === 'pending');
        const collected = data.filter(d => d.status === 'collected');
        
        return {
          totalPending: pending.reduce((sum, d) => sum + Number(d.fee_amount), 0),
          totalCollected: collected.reduce((sum, d) => sum + Number(d.fee_amount), 0),
          pendingCount: pending.length,
          collectedCount: collected.length,
        };
      }
    } catch (err) {
      console.error('[FeeCollection] Error:', err);
    }
  }
  
  // Memory fallback
  const pending = memoryFeeRecords.filter(r => r.status === 'pending');
  const collected = memoryFeeRecords.filter(r => r.status === 'collected');
  
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
export async function getAllFeeRecords(): Promise<FeeRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('fees')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        return data.map(d => ({
          id: d.id,
          orderId: d.order_id,
          merchantId: d.merchant_id,
          merchantAddress: d.merchant_address,
          grossAmount: d.gross_amount,
          netAmount: d.net_amount,
          feeAmount: d.fee_amount,
          currency: d.currency,
          network: d.network,
          status: d.status,
          collectionMethod: d.collection_method,
          collectionTxHash: d.collection_tx_hash,
          feeWallet: d.fee_wallet,
          createdAt: d.created_at,
          collectedAt: d.collected_at,
        }));
      }
    } catch (err) {
      console.error('[FeeCollection] Error:', err);
    }
  }
  
  return [...memoryFeeRecords];
}

/**
 * Get fees for a specific merchant
 */
export async function getMerchantFees(merchantId: string): Promise<{
  records: FeeRecord[];
  totalPaid: number;
  totalFees: number;
}> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('fees')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const records = data.map(d => ({
          id: d.id,
          orderId: d.order_id,
          merchantId: d.merchant_id,
          merchantAddress: d.merchant_address,
          grossAmount: d.gross_amount,
          netAmount: d.net_amount,
          feeAmount: d.fee_amount,
          currency: d.currency,
          network: d.network,
          status: d.status,
          collectionMethod: d.collection_method,
          collectionTxHash: d.collection_tx_hash,
          feeWallet: d.fee_wallet,
          createdAt: d.created_at,
          collectedAt: d.collected_at,
        }));
        
        return {
          records,
          totalPaid: records.reduce((sum, r) => sum + r.netAmount, 0),
          totalFees: records.reduce((sum, r) => sum + r.feeAmount, 0),
        };
      }
    } catch (err) {
      console.error('[FeeCollection] Error:', err);
    }
  }
  
  const records = memoryFeeRecords.filter(r => r.merchantId === merchantId);
  return {
    records,
    totalPaid: records.reduce((sum, r) => sum + r.netAmount, 0),
    totalFees: records.reduce((sum, r) => sum + r.feeAmount, 0),
  };
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

/**
 * Get supported networks for fee collection
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(STABLECOIN_ADDRESSES);
}

/**
 * Verify fee calculation for an order
 * Used to ensure merchant receives exactly 99% and platform 1%
 */
export function verifyFeeSplit(
  grossAmount: number,
  merchantReceived: number,
  feeCollected: number
): { valid: boolean; error?: string } {
  const expected = calculateFeeSplit(grossAmount);
  
  const merchantDiff = Math.abs(merchantReceived - expected.merchantAmount);
  const feeDiff = Math.abs(feeCollected - expected.feeAmount);
  
  // Allow for small rounding differences (up to 0.01)
  if (merchantDiff > 0.01) {
    return { 
      valid: false, 
      error: `Merchant amount mismatch: expected ${expected.merchantAmount}, got ${merchantReceived}` 
    };
  }
  
  if (feeDiff > 0.01) {
    return { 
      valid: false, 
      error: `Fee amount mismatch: expected ${expected.feeAmount}, got ${feeCollected}` 
    };
  }
  
  return { valid: true };
}
