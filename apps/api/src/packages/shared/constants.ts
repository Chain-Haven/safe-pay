// Constants for the SafePay system

/**
 * Platform fee percentage (1%)
 */
export const PLATFORM_FEE_PERCENT = 0.01;

/**
 * Order expiration time in minutes
 */
export const ORDER_EXPIRATION_MINUTES = 30;

/**
 * Swap polling interval in milliseconds
 */
export const STATUS_POLL_INTERVAL_MS = 8000;

/**
 * Nonce validity window in minutes (for replay protection)
 */
export const NONCE_VALIDITY_MINUTES = 10;

/**
 * Maximum request age in seconds (for timestamp validation)
 */
export const MAX_REQUEST_AGE_SECONDS = 300;

/**
 * Supported settlement currencies with their network options
 */
export const SETTLEMENT_OPTIONS = {
  USDC: {
    networks: ['ERC20', 'TRC20', 'BSC', 'POLYGON', 'SOL', 'ARB', 'AVAX', 'OP'],
    decimals: 6,
  },
  USDT: {
    networks: ['ERC20', 'TRC20', 'BSC', 'POLYGON', 'SOL', 'ARB', 'AVAX', 'OP'],
    decimals: 6,
  },
} as const;

/**
 * Network display names
 */
export const NETWORK_NAMES: Record<string, string> = {
  ERC20: 'Ethereum (ERC20)',
  TRC20: 'Tron (TRC20)',
  BSC: 'BNB Smart Chain (BEP20)',
  POLYGON: 'Polygon',
  SOL: 'Solana',
  ARB: 'Arbitrum',
  AVAX: 'Avalanche C-Chain',
  OP: 'Optimism',
};

/**
 * Address validation patterns by network
 */
export const ADDRESS_PATTERNS: Record<string, RegExp> = {
  ERC20: /^0x[a-fA-F0-9]{40}$/,
  BSC: /^0x[a-fA-F0-9]{40}$/,
  POLYGON: /^0x[a-fA-F0-9]{40}$/,
  ARB: /^0x[a-fA-F0-9]{40}$/,
  AVAX: /^0x[a-fA-F0-9]{40}$/,
  OP: /^0x[a-fA-F0-9]{40}$/,
  TRC20: /^T[a-zA-Z0-9]{33}$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
};

/**
 * Provider API endpoints
 */
export const PROVIDER_ENDPOINTS = {
  exolix: {
    base: 'https://exolix.com/api/v2',
    currencies: '/currencies',
    rate: '/rate',
    exchange: '/transactions',
    status: '/transactions',
  },
  fixedfloat: {
    base: 'https://ff.io/api/v2',
    currencies: '/ccies',
    price: '/price',
    create: '/create',
    status: '/order',
  },
} as const;

/**
 * Status mapping from provider statuses to our OrderStatus
 */
export const EXOLIX_STATUS_MAP: Record<string, string> = {
  wait: 'awaiting_deposit',
  confirmation: 'confirming',
  confirmed: 'confirming',
  exchanging: 'exchanging',
  sending: 'sending',
  success: 'completed',
  overdue: 'expired',
  refund: 'refunded',
};

export const FIXEDFLOAT_STATUS_MAP: Record<string, string> = {
  NEW: 'awaiting_deposit',
  PENDING: 'confirming',
  EXCHANGE: 'exchanging',
  WITHDRAW: 'sending',
  DONE: 'completed',
  EXPIRED: 'expired',
  EMERGENCY: 'failed',
};

/**
 * Known no-KYC swap API providers for discovery
 */
export const KNOWN_SWAP_PROVIDERS = [
  { name: 'Exolix', url: 'https://exolix.com', hasPublicApi: true },
  { name: 'FixedFloat', url: 'https://ff.io', hasPublicApi: true },
  { name: 'ChangeNow', url: 'https://changenow.io', hasPublicApi: false, note: 'Requires API key' },
  { name: 'SimpleSwap', url: 'https://simpleswap.io', hasPublicApi: false, note: 'Requires API key' },
  { name: 'StealthEX', url: 'https://stealthex.io', hasPublicApi: false, note: 'Requires API key' },
  { name: 'Changelly', url: 'https://changelly.com', hasPublicApi: false, note: 'Requires API key' },
  { name: 'Godex', url: 'https://godex.io', hasPublicApi: false, note: 'Requires API key' },
  { name: 'SwapZone', url: 'https://swapzone.io', hasPublicApi: false, note: 'Aggregator, requires key' },
];
