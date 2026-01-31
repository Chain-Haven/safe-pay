import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Polygon (MATIC) - Primary network, very cheap gas
    polygon: {
      url: process.env.POLYGON_RPC || "https://polygon-rpc.com",
      accounts: [PRIVATE_KEY],
      chainId: 137,
    },
    // BSC (BNB Chain)
    bsc: {
      url: process.env.BSC_RPC || "https://bsc-dataseed.binance.org",
      accounts: [PRIVATE_KEY],
      chainId: 56,
    },
    // Arbitrum One
    arbitrum: {
      url: process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc",
      accounts: [PRIVATE_KEY],
      chainId: 42161,
    },
    // Base
    base: {
      url: process.env.BASE_RPC || "https://mainnet.base.org",
      accounts: [PRIVATE_KEY],
      chainId: 8453,
    },
    // Optimism
    optimism: {
      url: process.env.OPTIMISM_RPC || "https://mainnet.optimism.io",
      accounts: [PRIVATE_KEY],
      chainId: 10,
    },
    // Avalanche C-Chain
    avalanche: {
      url: process.env.AVALANCHE_RPC || "https://api.avax.network/ext/bc/C/rpc",
      accounts: [PRIVATE_KEY],
      chainId: 43114,
    },
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
      arbitrumOne: process.env.ARBISCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
      optimisticEthereum: process.env.OPTIMISM_API_KEY || "",
      avalanche: process.env.SNOWTRACE_API_KEY || "",
    },
  },
};

export default config;
