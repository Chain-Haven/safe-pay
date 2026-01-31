// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SafePaySplitter
 * @notice Automatically splits incoming stablecoin payments between merchants and platform fee
 * @dev Payments are split 99% to merchant, 1% to fee wallet
 * 
 * Flow:
 * 1. Swap provider sends USDC/USDT to this contract
 * 2. Backend calls processPayment() with merchant address and order ID
 * 3. Contract splits: 99% to merchant, 1% to fee wallet
 */
contract SafePaySplitter is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Platform fee wallet - receives 1% of all payments
    address public feeWallet;
    
    // Fee percentage in basis points (100 = 1%, max 1000 = 10%)
    uint256 public feeBasisPoints;
    
    // Supported stablecoins (USDC, USDT, etc.)
    mapping(address => bool) public supportedTokens;
    
    // Processed orders to prevent double-processing
    mapping(bytes32 => bool) public processedOrders;
    
    // Pending balances per token (for tracking)
    mapping(address => uint256) public pendingBalance;
    
    // Stats
    uint256 public totalProcessed;
    uint256 public totalFeeCollected;
    
    // Events
    event PaymentProcessed(
        bytes32 indexed orderId,
        address indexed merchant,
        address indexed token,
        uint256 grossAmount,
        uint256 merchantAmount,
        uint256 feeAmount,
        uint256 timestamp
    );
    event FeeWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event FeeBasisPointsUpdated(uint256 oldBps, uint256 newBps);
    event TokenSupportUpdated(address indexed token, bool supported);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);
    
    /**
     * @notice Constructor
     * @param _feeWallet Address to receive platform fees
     * @param _feeBasisPoints Fee in basis points (100 = 1%)
     */
    constructor(address _feeWallet, uint256 _feeBasisPoints) Ownable(msg.sender) {
        require(_feeWallet != address(0), "Invalid fee wallet");
        require(_feeBasisPoints <= 1000, "Fee too high"); // Max 10%
        
        feeWallet = _feeWallet;
        feeBasisPoints = _feeBasisPoints;
    }
    
    /**
     * @notice Process a payment - splits funds between merchant and fee wallet
     * @param merchant Address to receive merchant portion (99%)
     * @param token ERC20 token address (USDC/USDT)
     * @param orderId Unique order identifier
     */
    function processPayment(
        address merchant,
        address token,
        bytes32 orderId
    ) external nonReentrant {
        require(merchant != address(0), "Invalid merchant address");
        require(supportedTokens[token], "Token not supported");
        require(!processedOrders[orderId], "Order already processed");
        
        // Get contract's token balance
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to process");
        
        // Mark as processed BEFORE transfers (reentrancy protection)
        processedOrders[orderId] = true;
        
        // Calculate split
        uint256 feeAmount = (balance * feeBasisPoints) / 10000;
        uint256 merchantAmount = balance - feeAmount;
        
        // Transfer to merchant (99%)
        IERC20(token).safeTransfer(merchant, merchantAmount);
        
        // Transfer to fee wallet (1%)
        if (feeAmount > 0) {
            IERC20(token).safeTransfer(feeWallet, feeAmount);
        }
        
        // Update stats
        totalProcessed += balance;
        totalFeeCollected += feeAmount;
        
        emit PaymentProcessed(
            orderId,
            merchant,
            token,
            balance,
            merchantAmount,
            feeAmount,
            block.timestamp
        );
    }
    
    /**
     * @notice Process payment with specific amount (for partial processing)
     * @param merchant Address to receive merchant portion
     * @param token ERC20 token address
     * @param amount Amount to process
     * @param orderId Unique order identifier
     */
    function processPaymentAmount(
        address merchant,
        address token,
        uint256 amount,
        bytes32 orderId
    ) external nonReentrant {
        require(merchant != address(0), "Invalid merchant address");
        require(supportedTokens[token], "Token not supported");
        require(!processedOrders[orderId], "Order already processed");
        require(amount > 0, "Amount must be > 0");
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "Insufficient balance");
        
        // Mark as processed
        processedOrders[orderId] = true;
        
        // Calculate split
        uint256 feeAmount = (amount * feeBasisPoints) / 10000;
        uint256 merchantAmount = amount - feeAmount;
        
        // Transfer to merchant
        IERC20(token).safeTransfer(merchant, merchantAmount);
        
        // Transfer to fee wallet
        if (feeAmount > 0) {
            IERC20(token).safeTransfer(feeWallet, feeAmount);
        }
        
        // Update stats
        totalProcessed += amount;
        totalFeeCollected += feeAmount;
        
        emit PaymentProcessed(
            orderId,
            merchant,
            token,
            amount,
            merchantAmount,
            feeAmount,
            block.timestamp
        );
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update fee wallet address
     */
    function setFeeWallet(address _feeWallet) external onlyOwner {
        require(_feeWallet != address(0), "Invalid fee wallet");
        address oldWallet = feeWallet;
        feeWallet = _feeWallet;
        emit FeeWalletUpdated(oldWallet, _feeWallet);
    }
    
    /**
     * @notice Update fee basis points
     */
    function setFeeBasisPoints(uint256 _feeBasisPoints) external onlyOwner {
        require(_feeBasisPoints <= 1000, "Fee too high (max 10%)");
        uint256 oldBps = feeBasisPoints;
        feeBasisPoints = _feeBasisPoints;
        emit FeeBasisPointsUpdated(oldBps, _feeBasisPoints);
    }
    
    /**
     * @notice Add or remove supported token
     */
    function setSupportedToken(address token, bool supported) external onlyOwner {
        require(token != address(0), "Invalid token address");
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }
    
    /**
     * @notice Batch add supported tokens
     */
    function setSupportedTokens(address[] calldata tokens, bool supported) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Invalid token address");
            supportedTokens[tokens[i]] = supported;
            emit TokenSupportUpdated(tokens[i], supported);
        }
    }
    
    /**
     * @notice Check if an order has been processed
     */
    function isOrderProcessed(bytes32 orderId) external view returns (bool) {
        return processedOrders[orderId];
    }
    
    /**
     * @notice Get contract balance for a token
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    /**
     * @notice Emergency withdraw - only owner, for stuck funds
     */
    function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdraw(token, amount, to);
    }
    
    /**
     * @notice Get contract stats
     */
    function getStats() external view returns (
        uint256 _totalProcessed,
        uint256 _totalFeeCollected,
        uint256 _feeBasisPoints,
        address _feeWallet
    ) {
        return (totalProcessed, totalFeeCollected, feeBasisPoints, feeWallet);
    }
}
