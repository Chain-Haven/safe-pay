-- SafePay Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Merchants Table
-- ============================================
CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    api_key TEXT UNIQUE NOT NULL,
    api_secret TEXT NOT NULL,
    store_name TEXT NOT NULL,
    store_url TEXT NOT NULL,
    settlement_currency TEXT NOT NULL DEFAULT 'USDC' CHECK (settlement_currency IN ('USDC', 'USDT')),
    settlement_network TEXT NOT NULL DEFAULT 'ERC20',
    payout_address TEXT NOT NULL,
    payout_memo TEXT,
    test_mode BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for API key lookups
CREATE INDEX IF NOT EXISTS idx_merchants_api_key ON merchants(api_key);

-- ============================================
-- Orders Table
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    external_order_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'awaiting_deposit', 'confirming', 'exchanging',
        'sending', 'completed', 'failed', 'expired', 'refunded'
    )),
    
    -- Pricing
    fiat_amount DECIMAL(18, 2) NOT NULL,
    fiat_currency TEXT NOT NULL,
    gross_receive DECIMAL(18, 6) NOT NULL,
    net_receive DECIMAL(18, 6) NOT NULL,
    
    -- Customer payment
    pay_currency TEXT,
    pay_network TEXT,
    deposit_address TEXT,
    deposit_amount DECIMAL(18, 8),
    deposit_memo TEXT,
    
    -- Settlement
    settlement_currency TEXT NOT NULL,
    settlement_network TEXT NOT NULL,
    settlement_address TEXT NOT NULL,
    settlement_amount DECIMAL(18, 6),
    
    -- Provider details
    provider TEXT,
    provider_swap_id TEXT,
    provider_status TEXT,
    
    -- Transaction hashes
    deposit_tx_hash TEXT,
    settlement_tx_hash TEXT,
    
    -- URLs
    success_url TEXT NOT NULL,
    cancel_url TEXT NOT NULL,
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Unique constraint for merchant + external order ID
    UNIQUE(merchant_id, external_order_id)
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON orders(expires_at);
CREATE INDEX IF NOT EXISTS idx_orders_provider_swap_id ON orders(provider_swap_id);

-- ============================================
-- Idempotency Keys Table
-- ============================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT NOT NULL,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (key, merchant_id)
);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- ============================================
-- Nonces Table (Replay Protection)
-- ============================================
CREATE TABLE IF NOT EXISTS nonces (
    hash TEXT NOT NULL,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (hash, merchant_id)
);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_nonces_expires ON nonces(expires_at);

-- ============================================
-- Provider Discoveries Table
-- ============================================
CREATE TABLE IF NOT EXISTS provider_discoveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    has_public_api BOOLEAN NOT NULL DEFAULT FALSE,
    requires_auth BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN (
        'discovered', 'reviewed', 'integrated', 'rejected'
    )),
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_provider_discoveries_status ON provider_discoveries(status);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_discoveries ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for backend API)
-- These policies allow the service role to perform all operations

CREATE POLICY "Service role full access to merchants"
    ON merchants FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to orders"
    ON orders FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to idempotency_keys"
    ON idempotency_keys FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to nonces"
    ON nonces FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to provider_discoveries"
    ON provider_discoveries FOR ALL
    USING (auth.role() = 'service_role');

-- Public read access to orders (for checkout page status)
CREATE POLICY "Public read access to orders"
    ON orders FOR SELECT
    USING (true);

-- ============================================
-- Functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_merchants_updated_at
    BEFORE UPDATE ON merchants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Cleanup function for expired records
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_records()
RETURNS void AS $$
BEGIN
    -- Delete expired nonces
    DELETE FROM nonces WHERE expires_at < NOW();
    
    -- Delete expired idempotency keys
    DELETE FROM idempotency_keys WHERE expires_at < NOW();
    
    -- Mark expired pending orders
    UPDATE orders 
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('pending', 'awaiting_deposit') 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Sample data for testing (optional)
-- ============================================
-- Uncomment to insert test data

-- INSERT INTO merchants (id, api_key, api_secret, store_name, store_url, settlement_currency, settlement_network, payout_address, test_mode)
-- VALUES (
--     'mch_test123',
--     'spk_test_abcdef123456',
--     'sps_test_secret789',
--     'Test Store',
--     'https://teststore.example.com',
--     'USDC',
--     'ERC20',
--     '0x742d35Cc6634C0532925a3b844Bc9e7595f5E5E5',
--     true
-- );
