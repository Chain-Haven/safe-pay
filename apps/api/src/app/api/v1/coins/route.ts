// GET /api/v1/coins
// Get list of supported payment currencies
import { NextRequest, NextResponse } from 'next/server';
import { rateShopper } from '@/packages/providers';

// Cache coins list for 1 hour
let cachedCoins: any[] | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  try {
    // Check cache
    if (cachedCoins && Date.now() - cacheTime < CACHE_DURATION) {
      return NextResponse.json({
        coins: cachedCoins,
        cached: true,
      });
    }

    // Fetch fresh coin list
    const coins = await rateShopper.getAllSupportedCoins();

    // Sort by popularity (common coins first)
    const popularOrder = ['BTC', 'ETH', 'LTC', 'XRP', 'DOGE', 'SOL', 'BNB', 'MATIC', 'AVAX', 'TRX'];
    
    coins.sort((a, b) => {
      const aIndex = popularOrder.indexOf(a.code);
      const bIndex = popularOrder.indexOf(b.code);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    // Update cache
    cachedCoins = coins;
    cacheTime = Date.now();

    return NextResponse.json({
      coins,
      count: coins.length,
      cached: false,
    });
  } catch (error: any) {
    console.error('Get coins error:', error);
    
    // Return cached data if available, even if stale
    if (cachedCoins) {
      return NextResponse.json({
        coins: cachedCoins,
        cached: true,
        stale: true,
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to get supported coins' },
      { status: 500 }
    );
  }
}
