// GET /api/health
// Health check endpoint
import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';

export async function GET() {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  
  return NextResponse.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    configured: {
      supabase: isSupabaseConfigured,
      ai_maintenance: hasAnthropicKey,
    },
    features: {
      auto_maintenance: hasAnthropicKey,
      rate_shopping: true,
      providers: ['exolix', 'fixedfloat'],
    },
  });
}
