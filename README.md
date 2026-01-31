# SafePay - Non-Custodial Crypto Payment Gateway for WooCommerce

Accept cryptocurrency payments directly to your wallet. Zero API keys, zero custody, zero complexity.

![SafePay](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![WooCommerce](https://img.shields.io/badge/WooCommerce-6.0+-purple)

## Features

- **Non-Custodial**: Payments go directly to your wallet. We never hold your funds.
- **100+ Cryptocurrencies**: Accept BTC, ETH, LTC, XRP, DOGE, SOL, and many more.
- **Stablecoin Settlement**: Receive payments in USDC or USDT on 8 different networks.
- **Zero API Keys**: Uses public swap APIs that require no registration.
- **Rate Shopping**: Automatically finds the best conversion rate across providers.
- **Beautiful Checkout**: Modern, responsive checkout page with QR codes.
- **AI-Powered Updates**: Daily cron job discovers new swap providers automatically.

## How It Works

```
Customer pays BTC/ETH/etc → Swap Provider → Merchant receives USDC/USDT
```

1. Customer selects "Pay with Crypto" at checkout
2. Customer chooses their preferred cryptocurrency
3. Customer scans QR code and sends payment
4. Payment is automatically converted via swap provider
5. Stablecoins arrive directly in merchant's wallet
6. Order is marked as paid

## Quick Start

### For Merchants (WooCommerce Plugin)

1. Download the plugin from `/download` on the hosted site
2. Upload to WordPress: Plugins → Add New → Upload Plugin
3. Activate the plugin
4. Go to WooCommerce → Settings → Payments → SafePay Crypto
5. Enter your wallet address, select stablecoin & network
6. Click "Register Store" to get credentials
7. Save and start accepting crypto!

### Self-Hosting

#### Prerequisites

- Node.js 18+
- pnpm 8+
- Vercel account (free tier)
- Supabase account (free tier)

#### 1. Clone the Repository

```bash
git clone https://github.com/Chain-Haven/safe-pay.git
cd safe-pay
pnpm install
```

#### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run the schema from `supabase/schema.sql`
4. Copy your project URL and service role key from Settings → API

#### 3. Configure Environment Variables

Create `apps/api/.env.local`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# Optional: Enable AI provider discovery
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Secure cron endpoints
CRON_SECRET=your-random-secret
```

#### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd apps/api
vercel

# Set environment variables in Vercel dashboard
# or via CLI:
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

#### 5. Build the Plugin

```bash
pnpm run build:plugin
```

The plugin zip will be at `apps/woocommerce-plugin/dist/wc-crypto-gateway.zip`

## Project Structure

```
safe-pay/
├── apps/
│   ├── api/                    # Next.js 14 API + Frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── api/v1/     # REST API routes
│   │   │   │   ├── checkout/   # Hosted checkout page
│   │   │   │   └── page.tsx    # Landing page
│   │   │   └── lib/            # Database, auth, AI discovery
│   │   └── vercel.json         # Cron job config
│   │
│   └── woocommerce-plugin/     # WooCommerce PHP plugin
│       ├── includes/           # Gateway & API client classes
│       └── wc-crypto-gateway.php
│
├── packages/
│   ├── shared/                 # Shared types, utils, constants
│   └── providers/              # Swap provider implementations
│       ├── providers/
│       │   ├── exolix.ts       # Exolix provider
│       │   └── fixedfloat.ts   # FixedFloat provider
│       ├── rate-shopper.ts     # Rate shopping logic
│       └── registry.ts         # Provider registry
│
└── supabase/
    └── schema.sql              # Database schema
```

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/merchant/register` | Register a new merchant |
| GET | `/api/v1/checkout/[orderId]` | Get checkout details |
| GET | `/api/v1/checkout/[orderId]/status` | Poll for status |
| POST | `/api/v1/checkout/[orderId]/swap` | Create swap |
| GET | `/api/v1/coins` | List supported coins |

### Authenticated Endpoints

Require HMAC-SHA256 signed requests:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/checkout/create` | Create checkout session |
| GET | `/api/v1/merchant/settings` | Get merchant settings |
| PUT | `/api/v1/merchant/settings` | Update settings |

### Cron Endpoints

| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/cron/daily-provider-check` | Daily 6am UTC | Discover new providers |
| `/api/cron/cleanup` | Every 6 hours | Clean expired records |

## Adding New Providers

The system is designed for easy provider extensibility:

1. Create a new class in `packages/providers/src/providers/`:

```typescript
import { ISwapProvider } from '../interfaces';

export class MyNewProvider implements ISwapProvider {
  readonly name = 'mynew' as const;
  readonly displayName = 'My New Provider';
  readonly enabled = true;

  async getSupportedCoins() { /* ... */ }
  async getQuote() { /* ... */ }
  async createSwap() { /* ... */ }
  async getSwapStatus() { /* ... */ }
}
```

2. Register in `packages/providers/src/registry.ts`:

```typescript
import { MyNewProvider } from './providers/mynew';

// In initializeDefaults():
this.register(new MyNewProvider(config));
```

3. The rate shopper will automatically include the new provider.

## AI Provider Discovery

When `ANTHROPIC_API_KEY` is set, the daily cron job will:

1. Use Claude to search for new no-KYC swap APIs
2. Analyze provider documentation
3. Generate provider implementation code
4. Log discoveries for manual review

To enable:
```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

## Security

- **HMAC-SHA256 Signatures**: All merchant API requests are signed
- **Nonce Replay Protection**: Prevents replay attacks
- **Timestamp Validation**: Rejects old requests
- **Idempotency Keys**: Prevents duplicate orders
- **Row Level Security**: Supabase RLS protects data

## Fees

- **Platform Fee**: 1% deducted from merchant settlement
- **No Customer Fees**: Customers pay only blockchain network fees
- **No Hidden Fees**: Rate shopping ensures best conversion rates

## Supported Networks

USDC and USDT settlement on:
- Ethereum (ERC20)
- Tron (TRC20)
- BNB Smart Chain (BEP20)
- Polygon
- Solana
- Arbitrum
- Avalanche C-Chain
- Optimism

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- [GitHub Issues](https://github.com/yourusername/safe-pay/issues)
- Email: support@safepay.example

---

**SafePay** - Accept crypto, receive stablecoins, never hold funds.
