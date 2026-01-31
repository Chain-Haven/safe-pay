// GET /api/download/plugin
// Serve the WooCommerce plugin zip file
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  // In production, this would serve a pre-built zip file
  // For development, we'll return a placeholder response
  
  const pluginPath = join(process.cwd(), '..', 'woocommerce-plugin', 'dist', 'wc-crypto-gateway.zip');
  
  if (existsSync(pluginPath)) {
    const file = readFileSync(pluginPath);
    
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="wc-crypto-gateway.zip"',
        'Content-Length': file.length.toString(),
      },
    });
  }
  
  // For development/demo, redirect to GitHub releases or return info
  return NextResponse.json({
    message: 'Plugin download',
    instructions: [
      '1. Build the plugin: pnpm run build:plugin',
      '2. Or download from GitHub releases',
      '3. The zip file will be available at /dist/wc-crypto-gateway.zip'
    ],
    github: 'https://github.com/yourusername/safe-pay/releases',
  }, { status: 200 });
}
