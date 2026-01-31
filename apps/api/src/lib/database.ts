// Database operations
import { supabase, DbMerchant, DbOrder, DbIdempotencyKey, DbNonce, DbProviderDiscovery } from './supabase';
import {
  generateApiKey,
  generateApiSecret,
  generateMerchantId,
  generateOrderId,
  hashValue,
} from '@/packages/shared';
import { ORDER_EXPIRATION_MINUTES, NONCE_VALIDITY_MINUTES } from '@/packages/shared';

// ============ Merchants ============

export async function createMerchant(data: {
  storeName: string;
  storeUrl: string;
  settlementCurrency: 'USDC' | 'USDT';
  settlementNetwork: string;
  payoutAddress: string;
  payoutMemo?: string;
  testMode?: boolean;
}): Promise<DbMerchant> {
  const merchant: Partial<DbMerchant> = {
    id: generateMerchantId(),
    api_key: generateApiKey(),
    api_secret: generateApiSecret(),
    store_name: data.storeName,
    store_url: data.storeUrl,
    settlement_currency: data.settlementCurrency,
    settlement_network: data.settlementNetwork,
    payout_address: data.payoutAddress,
    payout_memo: data.payoutMemo || null,
    test_mode: data.testMode ?? false,
  };

  const { data: created, error } = await supabase
    .from('merchants')
    .insert(merchant)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create merchant: ${error.message}`);
  }

  return created;
}

export async function getMerchantByApiKey(apiKey: string): Promise<DbMerchant | null> {
  const { data, error } = await supabase
    .from('merchants')
    .select()
    .eq('api_key', apiKey)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get merchant: ${error.message}`);
  }

  return data;
}

export async function getMerchantById(id: string): Promise<DbMerchant | null> {
  const { data, error } = await supabase
    .from('merchants')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get merchant: ${error.message}`);
  }

  return data;
}

export async function updateMerchant(
  id: string,
  updates: Partial<Pick<DbMerchant, 'settlement_currency' | 'settlement_network' | 'payout_address' | 'payout_memo' | 'test_mode'>>
): Promise<DbMerchant> {
  const { data, error } = await supabase
    .from('merchants')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update merchant: ${error.message}`);
  }

  return data;
}

// ============ Orders ============

export async function createOrder(data: {
  merchantId: string;
  externalOrderId: string;
  fiatAmount: number;
  fiatCurrency: string;
  grossReceive: number;
  netReceive: number;
  settlementCurrency: string;
  settlementNetwork: string;
  settlementAddress: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: any;
}): Promise<DbOrder> {
  const expiresAt = new Date(Date.now() + ORDER_EXPIRATION_MINUTES * 60 * 1000);

  const order: Partial<DbOrder> = {
    id: generateOrderId(),
    merchant_id: data.merchantId,
    external_order_id: data.externalOrderId,
    status: 'pending',
    fiat_amount: data.fiatAmount,
    fiat_currency: data.fiatCurrency,
    gross_receive: data.grossReceive,
    net_receive: data.netReceive,
    settlement_currency: data.settlementCurrency,
    settlement_network: data.settlementNetwork,
    settlement_address: data.settlementAddress,
    success_url: data.successUrl,
    cancel_url: data.cancelUrl,
    metadata: data.metadata || null,
    expires_at: expiresAt.toISOString(),
  };

  const { data: created, error } = await supabase
    .from('orders')
    .insert(order)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create order: ${error.message}`);
  }

  return created;
}

export async function getOrderById(id: string): Promise<DbOrder | null> {
  const { data, error } = await supabase
    .from('orders')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get order: ${error.message}`);
  }

  return data;
}

export async function getOrderByExternalId(merchantId: string, externalOrderId: string): Promise<DbOrder | null> {
  const { data, error } = await supabase
    .from('orders')
    .select()
    .eq('merchant_id', merchantId)
    .eq('external_order_id', externalOrderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get order: ${error.message}`);
  }

  return data;
}

export async function updateOrder(
  id: string,
  updates: Partial<Omit<DbOrder, 'id' | 'merchant_id' | 'created_at'>>
): Promise<DbOrder> {
  const { data, error } = await supabase
    .from('orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update order: ${error.message}`);
  }

  return data;
}

export async function getExpiredPendingOrders(): Promise<DbOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select()
    .in('status', ['pending', 'awaiting_deposit'])
    .lt('expires_at', new Date().toISOString());

  if (error) {
    throw new Error(`Failed to get expired orders: ${error.message}`);
  }

  return data || [];
}

// ============ Idempotency Keys ============

export async function getIdempotencyKey(key: string, merchantId: string): Promise<DbIdempotencyKey | null> {
  const { data, error } = await supabase
    .from('idempotency_keys')
    .select()
    .eq('key', key)
    .eq('merchant_id', merchantId)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get idempotency key: ${error.message}`);
  }

  return data;
}

export async function saveIdempotencyKey(key: string, merchantId: string, response: any): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const { error } = await supabase
    .from('idempotency_keys')
    .upsert({
      key,
      merchant_id: merchantId,
      response,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    throw new Error(`Failed to save idempotency key: ${error.message}`);
  }
}

// ============ Nonce (Replay Protection) ============

export async function isNonceUsed(nonce: string, merchantId: string): Promise<boolean> {
  const hash = hashValue(nonce);

  const { data, error } = await supabase
    .from('nonces')
    .select('hash')
    .eq('hash', hash)
    .eq('merchant_id', merchantId)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to check nonce: ${error.message}`);
  }

  return !!data;
}

export async function recordNonce(nonce: string, merchantId: string): Promise<void> {
  const hash = hashValue(nonce);
  const expiresAt = new Date(Date.now() + NONCE_VALIDITY_MINUTES * 60 * 1000);

  const { error } = await supabase
    .from('nonces')
    .insert({
      hash,
      merchant_id: merchantId,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    // Ignore duplicate key errors (nonce already used)
    if (!error.message.includes('duplicate')) {
      throw new Error(`Failed to record nonce: ${error.message}`);
    }
  }
}

// ============ Provider Discovery ============

export async function saveProviderDiscovery(discovery: {
  name: string;
  url: string;
  hasPublicApi: boolean;
  requiresAuth: boolean;
  notes: string;
}): Promise<void> {
  const { error } = await supabase
    .from('provider_discoveries')
    .upsert({
      name: discovery.name,
      url: discovery.url,
      has_public_api: discovery.hasPublicApi,
      requires_auth: discovery.requiresAuth,
      notes: discovery.notes,
      status: 'discovered',
      discovered_at: new Date().toISOString(),
    }, {
      onConflict: 'url',
    });

  if (error) {
    console.error('Failed to save provider discovery:', error);
  }
}

export async function getDiscoveredProviders(): Promise<DbProviderDiscovery[]> {
  const { data, error } = await supabase
    .from('provider_discoveries')
    .select()
    .order('discovered_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get discovered providers: ${error.message}`);
  }

  return data || [];
}

// ============ Cleanup ============

export async function cleanupExpiredRecords(): Promise<void> {
  const now = new Date().toISOString();

  // Clean up expired nonces
  await supabase.from('nonces').delete().lt('expires_at', now);

  // Clean up expired idempotency keys
  await supabase.from('idempotency_keys').delete().lt('expires_at', now);
}
