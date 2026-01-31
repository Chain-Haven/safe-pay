import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Fee wallet address - receives 1% of all payments
const FEE_WALLET = "0xaF109Ccf6b5e77A139253E4db48B95d6ea361146";

// Fee in basis points (100 = 1%)
const FEE_BASIS_POINTS = 100;

// Stablecoin addresses per network
const STABLECOINS: Record<string, { USDC: string; USDT: string }> = {
  polygon: {
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Native USDC
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  bsc: {
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
  },
  arbitrum: {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Native USDC
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  },
  base: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Native USDC
    USDT: "0x0000000000000000000000000000000000000000", // No native USDT on Base
  },
  optimism: {
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Native USDC
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  },
  avalanche: {
    USDC: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // Native USDC
    USDT: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
  },
};

async function main() {
  const networkName = network.name;
  console.log(`\n🚀 Deploying SafePaySplitter to ${networkName}...\n`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} native tokens\n`);

  // Deploy contract
  console.log("Deploying SafePaySplitter...");
  const SafePaySplitter = await ethers.getContractFactory("SafePaySplitter");
  const splitter = await SafePaySplitter.deploy(FEE_WALLET, FEE_BASIS_POINTS);
  
  await splitter.waitForDeployment();
  const splitterAddress = await splitter.getAddress();
  
  console.log(`✅ SafePaySplitter deployed to: ${splitterAddress}\n`);

  // Setup supported tokens
  const tokens = STABLECOINS[networkName];
  if (tokens) {
    console.log("Setting up supported tokens...");
    
    if (tokens.USDC && tokens.USDC !== "0x0000000000000000000000000000000000000000") {
      const tx1 = await splitter.setSupportedToken(tokens.USDC, true);
      await tx1.wait();
      console.log(`✅ USDC enabled: ${tokens.USDC}`);
    }
    
    if (tokens.USDT && tokens.USDT !== "0x0000000000000000000000000000000000000000") {
      const tx2 = await splitter.setSupportedToken(tokens.USDT, true);
      await tx2.wait();
      console.log(`✅ USDT enabled: ${tokens.USDT}`);
    }
  }

  // Save deployment info
  const deploymentInfo = {
    network: networkName,
    chainId: network.config.chainId,
    splitterAddress,
    feeWallet: FEE_WALLET,
    feeBasisPoints: FEE_BASIS_POINTS,
    tokens: tokens || {},
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📁 Deployment info saved to: ${deploymentPath}`);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Network:          ${networkName}`);
  console.log(`Contract Address: ${splitterAddress}`);
  console.log(`Fee Wallet:       ${FEE_WALLET}`);
  console.log(`Fee:              ${FEE_BASIS_POINTS / 100}%`);
  console.log(`Deployer:         ${deployer.address}`);
  console.log("=".repeat(60));
  
  console.log("\n⚡ Next steps:");
  console.log("1. Verify contract on block explorer (optional)");
  console.log("2. Update SPLITTER_CONTRACTS in constants.ts with:");
  console.log(`   ${networkName.toUpperCase()}: '${splitterAddress}'`);
  console.log("3. Redeploy the API to use the new contract");

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
