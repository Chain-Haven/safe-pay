// GET/POST /api/admin/fees
// Admin endpoint for viewing and managing platform fees
import { NextRequest, NextResponse } from 'next/server';
import { 
  getFeeSummary, 
  getAllFeeRecords, 
  getPendingFees,
  FEE_CONFIG,
  hasSplitterContract,
  getSupportedNetworks
} from '@/lib/fee-collection';
import { SPLITTER_CONTRACTS, STABLECOIN_ADDRESSES } from '@/packages/shared/constants';

export async function GET(request: NextRequest) {
  try {
    // Fetch data (now async for database access)
    const [summary, pendingFees, allRecords] = await Promise.all([
      getFeeSummary(),
      getPendingFees(),
      getAllFeeRecords(),
    ]);
    
    // Check which networks have splitter contracts deployed
    const networkStatus = Object.keys(SPLITTER_CONTRACTS).map(network => ({
      network,
      splitterDeployed: hasSplitterContract(network),
      splitterAddress: SPLITTER_CONTRACTS[network] || null,
      stablecoins: STABLECOIN_ADDRESSES[network] || {},
    }));

    return NextResponse.json({
      config: {
        feeWallet: FEE_CONFIG.walletAddress,
        feePercent: FEE_CONFIG.feePercent,
        feeBasisPoints: FEE_CONFIG.feeBasisPoints,
      },
      summary: {
        totalPendingUSD: summary.totalPending,
        totalCollectedUSD: summary.totalCollected,
        pendingTransactions: summary.pendingCount,
        collectedTransactions: summary.collectedCount,
      },
      networks: networkStatus,
      pendingFees: pendingFees.slice(0, 50), // Last 50 pending
      recentTransactions: allRecords.slice(0, 20), // Last 20 transactions
      
      // Fee collection explanation
      feeExplanation: {
        howItWorks: [
          '1. Customer pays in ANY crypto (BTC, ETH, XRP, SOL, etc.)',
          '2. Swap provider converts to USDC/USDT',
          '3. 99% goes to merchant wallet',
          '4. 1% goes to platform fee wallet',
        ],
        merchantGuarantee: 'Each merchant ONLY receives their own funds - never mixed with other merchants',
        platformFee: '1% of all transactions goes to: ' + FEE_CONFIG.walletAddress,
      },
      
      // Instructions for deploying splitter contracts
      deployment: {
        note: 'Deploy PaymentSplitter.sol to each network to enable automatic fee collection',
        contractPath: '/contracts/PaymentSplitter.sol',
        constructorArgs: {
          feeWallet: FEE_CONFIG.walletAddress,
          feeBasisPoints: 100, // 1%
        },
        postDeployment: [
          'Call setSupportedToken() for USDC and USDT addresses',
          'Update SPLITTER_CONTRACTS in constants.ts with deployed addresses',
          'Redeploy the API',
        ],
      },
    });
  } catch (error: any) {
    console.error('Fee admin error:', error);
    return NextResponse.json(
      { error: 'Failed to get fee data' },
      { status: 500 }
    );
  }
}
