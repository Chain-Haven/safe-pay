/**
 * Payment Processor Service
 * 
 * Monitors splitter contracts and triggers payment distribution.
 * Called by the status polling endpoint when a payment is confirmed.
 */

import { ethers } from 'ethers';
import { SPLITTER_CONTRACTS, STABLECOIN_ADDRESSES, FEE_WALLET_ADDRESS } from '@/packages/shared/constants';

// Splitter contract ABI (minimal)
const SPLITTER_ABI = [
  "function processPayment(address merchant, address token, bytes32 orderId) external",
  "function processPaymentAmount(address merchant, address token, uint256 amount, bytes32 orderId) external",
  "function getBalance(address token) external view returns (uint256)",
  "function isOrderProcessed(bytes32 orderId) external view returns (bool)",
  "function supportedTokens(address token) external view returns (bool)",
  "event PaymentProcessed(bytes32 indexed orderId, address indexed merchant, address indexed token, uint256 grossAmount, uint256 merchantAmount, uint256 feeAmount, uint256 timestamp)"
];

// RPC endpoints
const RPC_URLS: Record<string, string> = {
  POLYGON: process.env.POLYGON_RPC || 'https://polygon-rpc.com',
  BSC: process.env.BSC_RPC || 'https://bsc-dataseed.binance.org',
  ARB: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
  BASE: process.env.BASE_RPC || 'https://mainnet.base.org',
  OP: process.env.OPTIMISM_RPC || 'https://mainnet.optimism.io',
  AVAX: process.env.AVALANCHE_RPC || 'https://api.avax.network/ext/bc/C/rpc',
};

export interface ProcessPaymentResult {
  success: boolean;
  txHash?: string;
  merchantAmount?: number;
  feeAmount?: number;
  error?: string;
}

/**
 * Get provider for a network
 */
function getProvider(network: string): ethers.JsonRpcProvider | null {
  const rpcUrl = RPC_URLS[network.toUpperCase()];
  if (!rpcUrl) return null;
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Get signer for processing payments
 * Requires PROCESSOR_PRIVATE_KEY env var
 */
function getSigner(network: string): ethers.Wallet | null {
  const privateKey = process.env.PROCESSOR_PRIVATE_KEY;
  if (!privateKey) return null;
  
  const provider = getProvider(network);
  if (!provider) return null;
  
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Check if a splitter contract has pending balance for a token
 */
export async function checkSplitterBalance(
  network: string,
  token: string
): Promise<{ hasBalance: boolean; balance: string }> {
  const splitterAddress = SPLITTER_CONTRACTS[network.toUpperCase()];
  if (!splitterAddress) {
    return { hasBalance: false, balance: '0' };
  }

  const provider = getProvider(network);
  if (!provider) {
    return { hasBalance: false, balance: '0' };
  }

  try {
    const splitter = new ethers.Contract(splitterAddress, SPLITTER_ABI, provider);
    const tokenAddresses = STABLECOIN_ADDRESSES[network.toUpperCase()];
    const tokenAddress = tokenAddresses?.[token.toUpperCase()];
    
    if (!tokenAddress) {
      return { hasBalance: false, balance: '0' };
    }

    const balance = await splitter.getBalance(tokenAddress);
    return {
      hasBalance: balance > 0n,
      balance: ethers.formatUnits(balance, 6), // USDC/USDT have 6 decimals
    };
  } catch (error) {
    console.error('Error checking splitter balance:', error);
    return { hasBalance: false, balance: '0' };
  }
}

/**
 * Process a payment through the splitter contract
 */
export async function processPaymentOnChain(
  network: string,
  merchantAddress: string,
  settlementCurrency: string,
  orderId: string
): Promise<ProcessPaymentResult> {
  const splitterAddress = SPLITTER_CONTRACTS[network.toUpperCase()];
  if (!splitterAddress) {
    return { success: false, error: 'No splitter contract for this network' };
  }

  const signer = getSigner(network);
  if (!signer) {
    return { success: false, error: 'Processor wallet not configured' };
  }

  try {
    const splitter = new ethers.Contract(splitterAddress, SPLITTER_ABI, signer);
    
    // Get token address
    const tokenAddresses = STABLECOIN_ADDRESSES[network.toUpperCase()];
    const tokenAddress = tokenAddresses?.[settlementCurrency.toUpperCase()];
    
    if (!tokenAddress) {
      return { success: false, error: 'Token not supported on this network' };
    }

    // Convert order ID to bytes32
    const orderIdBytes32 = ethers.id(orderId);

    // Check if already processed
    const isProcessed = await splitter.isOrderProcessed(orderIdBytes32);
    if (isProcessed) {
      return { success: false, error: 'Order already processed' };
    }

    // Check balance
    const balance = await splitter.getBalance(tokenAddress);
    if (balance === 0n) {
      return { success: false, error: 'No funds to process' };
    }

    // Process payment
    console.log(`[Processor] Processing payment for order ${orderId}`);
    console.log(`[Processor] Merchant: ${merchantAddress}`);
    console.log(`[Processor] Token: ${tokenAddress}`);
    console.log(`[Processor] Balance: ${ethers.formatUnits(balance, 6)} ${settlementCurrency}`);

    const tx = await splitter.processPayment(merchantAddress, tokenAddress, orderIdBytes32);
    const receipt = await tx.wait();

    // Parse the event to get amounts
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = splitter.interface.parseLog(log);
        return parsed?.name === 'PaymentProcessed';
      } catch {
        return false;
      }
    });

    let merchantAmount = 0;
    let feeAmount = 0;

    if (event) {
      const parsed = splitter.interface.parseLog(event);
      if (parsed) {
        merchantAmount = parseFloat(ethers.formatUnits(parsed.args.merchantAmount, 6));
        feeAmount = parseFloat(ethers.formatUnits(parsed.args.feeAmount, 6));
      }
    }

    console.log(`[Processor] Payment processed! TX: ${receipt.hash}`);
    console.log(`[Processor] Merchant received: $${merchantAmount}`);
    console.log(`[Processor] Fee collected: $${feeAmount}`);

    return {
      success: true,
      txHash: receipt.hash,
      merchantAmount,
      feeAmount,
    };
  } catch (error: any) {
    console.error('[Processor] Error processing payment:', error);
    return {
      success: false,
      error: error.message || 'Failed to process payment',
    };
  }
}

/**
 * Check if network has splitter contract configured
 */
export function hasSplitterContract(network: string): boolean {
  const address = SPLITTER_CONTRACTS[network.toUpperCase()];
  return !!address && address.length > 0 && address !== '';
}

/**
 * Get splitter contract address for a network
 */
export function getSplitterAddress(network: string): string | null {
  return SPLITTER_CONTRACTS[network.toUpperCase()] || null;
}

/**
 * Payment processor configuration status
 */
export function getProcessorStatus(): {
  configured: boolean;
  walletAddress: string | null;
  networks: { network: string; splitterDeployed: boolean; address: string | null }[];
} {
  const privateKey = process.env.PROCESSOR_PRIVATE_KEY;
  let walletAddress: string | null = null;

  if (privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey);
      walletAddress = wallet.address;
    } catch {
      // Invalid private key
    }
  }

  const networks = Object.keys(SPLITTER_CONTRACTS).map(network => ({
    network,
    splitterDeployed: hasSplitterContract(network),
    address: getSplitterAddress(network),
  }));

  return {
    configured: !!walletAddress,
    walletAddress,
    networks,
  };
}
