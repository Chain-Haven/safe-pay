// GET /api/cron/process-payments
// Cron job to auto-process payments on splitter contracts
// Runs every 5 minutes to check for and process pending payments

import { NextRequest, NextResponse } from 'next/server';
import { 
  checkSplitterBalance, 
  processPaymentOnChain, 
  hasSplitterContract,
  getProcessorStatus 
} from '@/lib/payment-processor';
import { SPLITTER_CONTRACTS, STABLECOIN_ADDRESSES } from '@/packages/shared/constants';

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) return true; // Allow if not configured (dev mode)
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: any[] = [];
  const processorStatus = getProcessorStatus();

  if (!processorStatus.configured) {
    return NextResponse.json({
      success: false,
      error: 'Processor wallet not configured. Set PROCESSOR_PRIVATE_KEY env var.',
      processorStatus,
    });
  }

  // Check each network with a deployed splitter
  for (const network of Object.keys(SPLITTER_CONTRACTS)) {
    if (!hasSplitterContract(network)) continue;

    const tokens = STABLECOIN_ADDRESSES[network];
    if (!tokens) continue;

    // Check balance for each stablecoin
    for (const [tokenSymbol, tokenAddress] of Object.entries(tokens)) {
      if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') continue;

      try {
        const balanceResult = await checkSplitterBalance(network, tokenSymbol);
        
        results.push({
          network,
          token: tokenSymbol,
          hasBalance: balanceResult.hasBalance,
          balance: balanceResult.balance,
          status: balanceResult.hasBalance ? 'pending_processing' : 'no_balance',
        });

        // Note: We don't auto-process here because we need the merchant address
        // The actual processing happens when the order status is checked
        // This cron just reports on pending balances
      } catch (error: any) {
        results.push({
          network,
          token: tokenSymbol,
          error: error.message,
          status: 'error',
        });
      }
    }
  }

  // Count pending payments
  const pendingCount = results.filter(r => r.hasBalance).length;
  const totalPending = results
    .filter(r => r.hasBalance)
    .reduce((sum, r) => sum + parseFloat(r.balance || '0'), 0);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    processorStatus: {
      configured: processorStatus.configured,
      walletAddress: processorStatus.walletAddress,
    },
    summary: {
      networksChecked: Object.keys(SPLITTER_CONTRACTS).filter(n => hasSplitterContract(n)).length,
      pendingPayments: pendingCount,
      totalPendingUSD: totalPending,
    },
    results,
  });
}

// Also allow POST for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
