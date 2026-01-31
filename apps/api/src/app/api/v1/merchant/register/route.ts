// POST /api/v1/merchant/register
// Create a new merchant account
import { NextRequest, NextResponse } from 'next/server';
import { createMerchant } from '@/lib/database';
import {
  isValidSettlementCurrency,
  isValidSettlementNetwork,
  validateAddress,
  isValidUrl,
  validateRequiredFields,
} from '@/packages/shared';

interface RegisterRequest {
  store_name: string;
  store_url: string;
  settlement_currency: string;
  settlement_network: string;
  payout_address: string;
  payout_memo?: string;
  test_mode?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!validateRequiredFields<RegisterRequest>(body, [
      'store_name',
      'store_url',
      'settlement_currency',
      'settlement_network',
      'payout_address',
    ])) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const {
      store_name,
      store_url,
      settlement_currency,
      settlement_network,
      payout_address,
      payout_memo,
      test_mode,
    } = body as RegisterRequest;

    // Validate settlement currency
    if (!isValidSettlementCurrency(settlement_currency)) {
      return NextResponse.json(
        { error: 'Invalid settlement currency. Must be USDC or USDT' },
        { status: 400 }
      );
    }

    // Validate settlement network
    if (!isValidSettlementNetwork(settlement_currency, settlement_network)) {
      return NextResponse.json(
        { error: 'Invalid settlement network for the selected currency' },
        { status: 400 }
      );
    }

    // Validate store URL
    if (!isValidUrl(store_url)) {
      return NextResponse.json(
        { error: 'Invalid store URL' },
        { status: 400 }
      );
    }

    // Validate payout address
    if (!validateAddress(payout_address, settlement_network)) {
      return NextResponse.json(
        { error: 'Invalid payout address format for the selected network' },
        { status: 400 }
      );
    }

    // Create merchant
    const merchant = await createMerchant({
      storeName: store_name,
      storeUrl: store_url,
      settlementCurrency: settlement_currency,
      settlementNetwork: settlement_network,
      payoutAddress: payout_address,
      payoutMemo: payout_memo,
      testMode: test_mode,
    });

    // Return credentials (only shown once!)
    return NextResponse.json({
      success: true,
      merchant: {
        id: merchant.id,
        api_key: merchant.api_key,
        api_secret: merchant.api_secret,
        store_name: merchant.store_name,
        settlement_currency: merchant.settlement_currency,
        settlement_network: merchant.settlement_network,
        test_mode: merchant.test_mode,
      },
      message: 'Store your API key and secret securely. The secret will not be shown again.',
    });
  } catch (error: any) {
    console.error('Merchant registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register merchant' },
      { status: 500 }
    );
  }
}
