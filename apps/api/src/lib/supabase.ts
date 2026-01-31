// Supabase client configuration
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseServiceKey;

// Server-side client with service role (full access)
// Note: Will throw errors if not configured when actually used
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabase;
}

// Lazy-loaded supabase client for backward compatibility
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    return (getSupabase() as any)[prop];
  },
});

// Public client for client-side usage (limited access via RLS)
export function createPublicClient() {
  const anonKey = process.env.SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, anonKey);
}

// Database types
export interface DbMerchant {
  id: string;
  api_key: string;
  api_secret: string;
  store_name: string;
  store_url: string;
  settlement_currency: 'USDC' | 'USDT';
  settlement_network: string;
  payout_address: string;
  payout_memo: string | null;
  test_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbOrder {
  id: string;
  merchant_id: string;
  external_order_id: string;
  status: string;
  fiat_amount: number;
  fiat_currency: string;
  gross_receive: number;
  net_receive: number;
  pay_currency: string | null;
  pay_network: string | null;
  deposit_address: string | null;
  deposit_amount: number | null;
  deposit_memo: string | null;
  settlement_currency: string;
  settlement_network: string;
  settlement_address: string;
  settlement_amount: number | null;
  provider: string | null;
  provider_swap_id: string | null;
  provider_status: string | null;
  deposit_tx_hash: string | null;
  settlement_tx_hash: string | null;
  success_url: string;
  cancel_url: string;
  metadata: any;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface DbIdempotencyKey {
  key: string;
  merchant_id: string;
  response: any;
  created_at: string;
  expires_at: string;
}

export interface DbNonce {
  hash: string;
  merchant_id: string;
  created_at: string;
  expires_at: string;
}

export interface DbProviderDiscovery {
  id: string;
  name: string;
  url: string;
  has_public_api: boolean;
  requires_auth: boolean;
  notes: string;
  status: 'discovered' | 'reviewed' | 'integrated' | 'rejected';
  discovered_at: string;
  reviewed_at: string | null;
}
