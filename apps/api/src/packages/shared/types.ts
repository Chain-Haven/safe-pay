// Core types for the SafePay system

/**
 * Supported settlement currencies (what merchants receive)
 */
export type SettlementCurrency = 'USDC' | 'USDT';

/**
 * Supported networks for settlement
 */
export type SettlementNetwork = 
  | 'ERC20'      // Ethereum
  | 'TRC20'      // Tron
  | 'BSC'        // BNB Smart Chain
  | 'POLYGON'    // Polygon
  | 'SOL'        // Solana
  | 'ARB'        // Arbitrum
  | 'AVAX'       // Avalanche C-Chain
  | 'OP';        // Optimism

/**
 * Order status throughout the payment lifecycle
 */
export type OrderStatus = 
  | 'pending'           // Order created, awaiting payment
  | 'awaiting_deposit'  // Swap created, waiting for customer deposit
  | 'confirming'        // Deposit received, awaiting confirmations
  | 'exchanging'        // Swap in progress
  | 'sending'           // Sending to merchant address
  | 'completed'         // Payment successful
  | 'failed'            // Payment failed
  | 'expired'           // Order expired (no deposit received)
  | 'refunded';         // Refunded to customer

/**
 * Swap provider identifiers
 */
export type SwapProvider = 
  | 'exolix' 
  | 'fixedfloat' 
  | 'changenow' 
  | 'simpleswap' 
  | 'stealthex' 
  | 'changelly';

/**
 * Merchant configuration stored in database
 */
export interface Merchant {
  id: string;
  api_key: string;
  api_secret: string;
  store_name: string;
  store_url: string;
  settlement_currency: SettlementCurrency;
  settlement_network: SettlementNetwork;
  payout_address: string;
  payout_memo?: string;        // For networks that require memo/tag
  test_mode: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Order record stored in database
 */
export interface Order {
  id: string;
  merchant_id: string;
  external_order_id: string;   // WooCommerce order ID
  status: OrderStatus;
  
  // Pricing
  fiat_amount: number;         // Original order amount in fiat
  fiat_currency: string;       // USD, EUR, etc.
  gross_receive: number;       // Amount before platform fee
  net_receive: number;         // Amount after 1% fee (merchant receives)
  
  // Customer payment
  pay_currency: string;        // BTC, ETH, etc.
  pay_network: string;         // Network for pay currency
  deposit_address: string;     // Where customer sends funds
  deposit_amount: number;      // Expected deposit amount
  deposit_memo?: string;       // Memo for deposit if required
  
  // Settlement
  settlement_currency: SettlementCurrency;
  settlement_network: SettlementNetwork;
  settlement_address: string;  // Merchant payout address
  settlement_amount?: number;  // Actual amount sent to merchant
  
  // Provider details
  provider: SwapProvider;
  provider_swap_id: string;    // Swap ID from provider
  provider_status?: string;    // Raw status from provider
  
  // Transaction details
  deposit_tx_hash?: string;
  settlement_tx_hash?: string;
  
  // URLs
  success_url: string;
  cancel_url: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  expires_at: string;
}

/**
 * Quote from a swap provider
 */
export interface SwapQuote {
  provider: SwapProvider;
  depositAmount: number;       // Amount customer must send
  depositCurrency: string;
  depositNetwork: string;
  withdrawAmount: number;      // Fixed amount merchant receives
  withdrawCurrency: string;
  withdrawNetwork: string;
  rate: number;               // Exchange rate
  minAmount: number;          // Minimum deposit
  maxAmount: number;          // Maximum deposit
  estimatedTime: number;      // Minutes
}

/**
 * Created swap details
 */
export interface SwapDetails {
  provider: SwapProvider;
  swapId: string;
  depositAddress: string;
  depositAmount: number;
  depositCurrency: string;
  depositNetwork: string;
  depositMemo?: string;
  withdrawAmount: number;
  withdrawAddress: string;
  expiresAt: string;
}

/**
 * Swap status from provider
 */
export interface SwapStatus {
  provider: SwapProvider;
  swapId: string;
  status: string;              // Provider-specific status
  normalizedStatus: OrderStatus;
  depositTxHash?: string;
  withdrawTxHash?: string;
  depositConfirmations?: number;
  requiredConfirmations?: number;
}

/**
 * Supported coin for payments
 */
export interface SupportedCoin {
  code: string;                // BTC, ETH, etc.
  name: string;                // Bitcoin, Ethereum, etc.
  networks: string[];          // Available networks
  icon?: string;               // Icon URL
}

/**
 * API request for creating checkout
 */
export interface CreateCheckoutRequest {
  external_order_id: string;
  fiat_amount: number;
  fiat_currency: string;
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, any>;
}

/**
 * API response for created checkout
 */
export interface CreateCheckoutResponse {
  order_id: string;
  checkout_url: string;
  expires_at: string;
}

/**
 * Request to create swap (after customer selects coin)
 */
export interface CreateSwapRequest {
  order_id: string;
  pay_currency: string;
  pay_network: string;
}

/**
 * Idempotency key record
 */
export interface IdempotencyKey {
  key: string;
  merchant_id: string;
  response: any;
  created_at: string;
  expires_at: string;
}

/**
 * Provider discovery result (for cron job)
 */
export interface ProviderDiscoveryResult {
  name: string;
  url: string;
  hasPublicApi: boolean;
  requiresAuth: boolean;
  notes: string;
  discoveredAt: string;
}
