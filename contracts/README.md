# SafePay Payment Splitter Contracts

Smart contracts for automatic 1% fee collection on all payments.

## How It Works

```
Customer pays BTC/ETH/etc
         ↓
Swap Provider converts to USDC
         ↓
USDC sent to SafePaySplitter contract
         ↓
Contract automatically splits:
  → 99% to Merchant's wallet
  → 1% to Fee wallet (0xaF109Ccf6b5e77A139253E4db48B95d6ea361146)
```

## Quick Deploy (Remix IDE - No Setup Required)

### Step 1: Open Remix
Go to https://remix.ethereum.org

### Step 2: Create Contract File
1. In the File Explorer, create a new file called `SafePaySplitter.sol`
2. Copy the entire contents of `PaymentSplitter.sol` into it

### Step 3: Add OpenZeppelin Imports
In Remix, the imports will auto-resolve from npm. If not, use these URLs:
```solidity
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/token/ERC20/IERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/token/ERC20/utils/SafeERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/utils/ReentrancyGuard.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/access/Ownable.sol";
```

### Step 4: Compile
1. Go to "Solidity Compiler" tab (left sidebar)
2. Select compiler version `0.8.19`
3. Click "Compile SafePaySplitter.sol"

### Step 5: Deploy
1. Go to "Deploy & Run Transactions" tab
2. Environment: Select "Injected Provider - MetaMask"
3. Connect your wallet with funds for gas
4. Constructor arguments:
   - `_feeWallet`: `0xaF109Ccf6b5e77A139253E4db48B95d6ea361146`
   - `_feeBasisPoints`: `100` (1%)
5. Click "Deploy"
6. Confirm in MetaMask

### Step 6: Configure Tokens
After deployment, call these functions:

**For Polygon:**
```
setSupportedToken("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", true)  // USDC
setSupportedToken("0xc2132D05D31c914a87C6611C10748AEb04B58e8F", true)  // USDT
```

**For BSC:**
```
setSupportedToken("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", true)  // USDC
setSupportedToken("0x55d398326f99059fF775485246999027B3197955", true)  // USDT
```

**For Arbitrum:**
```
setSupportedToken("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", true)  // USDC
setSupportedToken("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", true)  // USDT
```

**For Base:**
```
setSupportedToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", true)  // USDC
```

### Step 7: Update SafePay Configuration
After deployment, update `/apps/api/src/packages/shared/constants.ts`:

```typescript
export const SPLITTER_CONTRACTS: Record<string, string> = {
  POLYGON: '0xYourDeployedAddress...',
  BSC: '0xYourDeployedAddress...',
  ARB: '0xYourDeployedAddress...',
  BASE: '0xYourDeployedAddress...',
};
```

## Network Deployment Checklist

| Network | Gas Token | Estimated Cost | Priority |
|---------|-----------|----------------|----------|
| Polygon | MATIC | ~$0.10 | HIGH (cheapest, most popular) |
| Base | ETH | ~$0.50 | MEDIUM |
| Arbitrum | ETH | ~$0.30 | MEDIUM |
| BSC | BNB | ~$0.20 | MEDIUM |

## Using Hardhat (Advanced)

### Setup
```bash
cd contracts
npm install
cp .env.example .env
# Edit .env with your private key and RPC URLs
```

### Deploy
```bash
npm run deploy:polygon    # Deploy to Polygon
npm run deploy:bsc        # Deploy to BSC
npm run deploy:arbitrum   # Deploy to Arbitrum
npm run deploy:all        # Deploy to all networks
```

## Contract Functions

### `processPayment(merchant, token, orderId)`
Processes a payment by splitting funds:
- 99% to merchant address
- 1% to fee wallet

### `getBalance(token)`
Returns the contract's balance of a specific token.

### `isOrderProcessed(orderId)`
Checks if an order has already been processed.

### `getStats()`
Returns total processed volume and fees collected.

## Security

- ReentrancyGuard prevents reentrancy attacks
- Order IDs prevent double-processing
- Only owner can modify settings
- Emergency withdraw available for stuck funds

## Fee Configuration

Default: 1% (100 basis points)
Maximum: 10% (1000 basis points)

To change fee:
```solidity
setFeeBasisPoints(150)  // Set to 1.5%
```

## Support

For issues or questions, open a GitHub issue at:
https://github.com/Chain-Haven/safe-pay/issues
