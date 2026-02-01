// Constants for the SafePay system

/**
 * Platform fee percentage (1%)
 */
export const PLATFORM_FEE_PERCENT = 0.01;

/**
 * Platform fee basis points (100 = 1%)
 */
export const PLATFORM_FEE_BASIS_POINTS = 100;

/**
 * Platform fee wallet address - receives 1% of all transactions
 */
export const FEE_WALLET_ADDRESS = '0xaF109Ccf6b5e77A139253E4db48B95d6ea361146';

/**
 * Payment splitter contract addresses by network
 * These contracts automatically split payments 99% to merchant, 1% to fee wallet
 */
export const SPLITTER_CONTRACTS: Record<string, string> = {
  // Deployed payment splitter contracts (1% auto-split to fee wallet)
  POLYGON: '0xfd374aA3bc64368fbE79b31698671221bbaaFBf3', // Deployed!
  BSC: '',     // To be deployed
  ARB: '',     // To be deployed
  OP: '',      // To be deployed
  AVAX: '',    // To be deployed
  ERC20: '',   // Ethereum mainnet - To be deployed
};

/**
 * Stablecoin contract addresses by network
 */
export const STABLECOIN_ADDRESSES: Record<string, Record<string, string>> = {
  POLYGON: {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC on Polygon
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  BSC: {
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
  },
  ARB: {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Native USDC on Arbitrum
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  ERC20: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
};

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
 * Default settlement configuration - ALL payments settle to USDT on Polygon
 * This ensures automatic fee splitting via the deployed smart contract
 */
export const DEFAULT_SETTLEMENT = {
  currency: 'USDT' as const,
  network: 'POLYGON' as const,
};

/**
 * Supported settlement currencies with their network options
 * Simplified to USDT on Polygon for automatic fee collection
 */
export const SETTLEMENT_OPTIONS = {
  USDT: {
    networks: ['POLYGON'],
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
  changenow: {
    base: 'https://api.changenow.io/v2',
    currencies: '/exchange/currencies',
    estimate: '/exchange/estimated-amount',
    exchange: '/exchange',
    status: '/exchange/by-id',
  },
  simpleswap: {
    base: 'https://api.simpleswap.io',
    currencies: '/get_all_currencies',
    estimate: '/get_estimated',
    exchange: '/create_exchange',
    status: '/get_exchange',
  },
  stealthex: {
    base: 'https://api.stealthex.io/api/v2',
    currencies: '/currencies',
    estimate: '/estimate',
    exchange: '/exchange',
    status: '/exchange',
  },
  changelly: {
    base: 'https://api.changelly.com/v2',
    currencies: '/currencies',
    estimate: '/exchange-amount',
    exchange: '/create-transaction',
    status: '/transactions',
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

export const CHANGENOW_STATUS_MAP: Record<string, string> = {
  new: 'awaiting_deposit',
  waiting: 'awaiting_deposit',
  confirming: 'confirming',
  exchanging: 'exchanging',
  sending: 'sending',
  finished: 'completed',
  failed: 'failed',
  refunded: 'refunded',
  expired: 'expired',
};

export const SIMPLESWAP_STATUS_MAP: Record<string, string> = {
  waiting: 'awaiting_deposit',
  confirming: 'confirming',
  exchanging: 'exchanging',
  sending: 'sending',
  finished: 'completed',
  failed: 'failed',
  refunded: 'refunded',
  expired: 'expired',
};

export const STEALTHEX_STATUS_MAP: Record<string, string> = {
  waiting: 'awaiting_deposit',
  confirming: 'confirming',
  exchanging: 'exchanging',
  sending: 'sending',
  finished: 'completed',
  failed: 'failed',
  refunded: 'refunded',
  expired: 'expired',
};

export const CHANGELLY_STATUS_MAP: Record<string, string> = {
  new: 'awaiting_deposit',
  waiting: 'awaiting_deposit',
  confirming: 'confirming',
  exchanging: 'exchanging',
  sending: 'sending',
  finished: 'completed',
  failed: 'failed',
  refunded: 'refunded',
  overdue: 'expired',
  hold: 'pending',
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
