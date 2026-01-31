-- Fees table for tracking platform fee collection
-- Tracks 1% fee on all transactions

CREATE TABLE IF NOT EXISTS fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES orders(id),
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  merchant_address TEXT NOT NULL,
  
  -- Amount tracking
  gross_amount DECIMAL(18, 6) NOT NULL,  -- Total amount before fee
  net_amount DECIMAL(18, 6) NOT NULL,     -- Amount merchant receives (99%)
  fee_amount DECIMAL(18, 6) NOT NULL,     -- Platform fee (1%)
  
  -- Currency info
  currency TEXT NOT NULL,                  -- USDC, USDT
  network TEXT NOT NULL,                   -- POLYGON, BSC, ARB, etc.
  
  -- Collection status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, collected, failed
  collection_method TEXT,                  -- splitter_contract, manual
  collection_tx_hash TEXT,                 -- TX hash when collected
  
  -- Fee wallet (where 1% goes)
  fee_wallet TEXT NOT NULL DEFAULT '0xaF109Ccf6b5e77A139253E4db48B95d6ea361146',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  collected_at TIMESTAMPTZ,
  
  -- Indexes for common queries
  CONSTRAINT unique_order_fee UNIQUE (order_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_fees_merchant ON fees(merchant_id);
CREATE INDEX IF NOT EXISTS idx_fees_status ON fees(status);
CREATE INDEX IF NOT EXISTS idx_fees_created ON fees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fees_network ON fees(network);

-- Enable RLS
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;

-- Policy: Allow full access through service role
CREATE POLICY "Service role full access to fees" ON fees
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- View for fee summary by merchant
CREATE OR REPLACE VIEW merchant_fee_summary AS
SELECT 
  merchant_id,
  COUNT(*) as total_transactions,
  SUM(gross_amount) as total_gross,
  SUM(net_amount) as total_net,
  SUM(fee_amount) as total_fees,
  SUM(CASE WHEN status = 'pending' THEN fee_amount ELSE 0 END) as pending_fees,
  SUM(CASE WHEN status = 'collected' THEN fee_amount ELSE 0 END) as collected_fees
FROM fees
GROUP BY merchant_id;

-- View for platform-wide fee summary
CREATE OR REPLACE VIEW platform_fee_summary AS
SELECT 
  COUNT(*) as total_transactions,
  SUM(gross_amount) as total_gross_volume,
  SUM(fee_amount) as total_fees,
  SUM(CASE WHEN status = 'pending' THEN fee_amount ELSE 0 END) as pending_fees,
  SUM(CASE WHEN status = 'collected' THEN fee_amount ELSE 0 END) as collected_fees,
  COUNT(DISTINCT merchant_id) as total_merchants
FROM fees;
