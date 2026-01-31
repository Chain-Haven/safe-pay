// GET/POST /api/admin/fees
// Admin endpoint for viewing and managing platform fees
import { NextRequest, NextResponse } from 'next/server';
import { 
  getFeeSummary, 
  getAllFeeRecords, 
  getPendingFees,
  FEE_CONFIG,
  hasSplitterContract
} from '@/lib/fee-collection';
import { SPLITTER_CONTRACTS, STABLECOIN_ADDRESSES } from '@/packages/shared/constants';

export async function GET(request: NextRequest) {
  try {
    const summary = getFeeSummary();
    const pendingFees = getPendingFees();
    const allRecords = getAllFeeRecords();
    
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
      recentTransactions: allRecords.slice(-20).reverse(), // Last 20 transactions
      
      // Instructions for deploying splitter contracts
      deployment: {
        note: 'Deploy PaymentSplitter.sol to each network to enable automatic fee collection',
        contractPath: '/contracts/PaymentSplitter.sol',
        constructorArgs: {
          feeWallet: FEE_CONFIG.walletAddress,
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
