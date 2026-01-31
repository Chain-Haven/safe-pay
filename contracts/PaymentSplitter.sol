// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SafePaySplitter
 * @notice Automatically splits incoming stablecoin payments between merchants and platform fee
 * @dev Each payment is split 99% to merchant, 1% to fee wallet
 */
contract SafePaySplitter is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Platform fee wallet - receives 1% of all payments
    address public feeWallet;
    
    // Fee percentage in basis points (100 = 1%)
    uint256 public feeBasisPoints = 100;
    
    // Supported stablecoins
    mapping(address => bool) public supportedTokens;
    
    // Merchant payment tracking
    struct Payment {
        address merchant;
        address token;
        uint256 grossAmount;
        uint256 merchantAmount;
        uint256 feeAmount;
        uint256 timestamp;
        bytes32 orderId;
    }
    
    // Payment history
    Payment[] public payments;
    mapping(bytes32 => bool) public processedOrders;
    
    // Events
    event PaymentSplit(
        bytes32 indexed orderId,
        address indexed merchant,
        address indexed token,
        uint256 grossAmount,
        uint256 merchantAmount,
        uint256 feeAmount
    );
    event FeeWalletUpdated(address oldWallet, address newWallet);
    event FeeBasisPointsUpdated(uint256 oldBps, uint256 newBps);
    event TokenSupportUpdated(address token, bool supported);
    
    constructor(address _feeWallet) {
        require(_feeWallet != address(0), "Invalid fee wallet");
        feeWallet = _feeWallet;
    }
    
    /**
     * @notice Process an incoming payment and split between merchant and fee wallet
     * @param merchant Address to receive 99% of payment
     * @param token ERC20 token address (USDC/USDT)
     * @param amount Total amount to split
     * @param orderId Unique order identifier to prevent double processing
     */
    function splitPayment(
        address merchant,
        address token,
        uint256 amount,
        bytes32 orderId
    ) external nonReentrant {
        require(merchant != address(0), "Invalid merchant");
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be > 0");
        require(!processedOrders[orderId], "Order already processed");
        
        // Mark order as processed
        processedOrders[orderId] = true;
        
        // Calculate split
        uint256 feeAmount = (amount * feeBasisPoints) / 10000;
        uint256 merchantAmount = amount - feeAmount;
        
        // Transfer tokens from sender
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Send to merchant (99%)
        IERC20(token).safeTransfer(merchant, merchantAmount);
        
        // Send to fee wallet (1%)
        IERC20(token).safeTransfer(feeWallet, feeAmount);
        
        // Record payment
        payments.push(Payment({
            merchant: merchant,
            token: token,
            grossAmount: amount,
            merchantAmount: merchantAmount,
            feeAmount: feeAmount,
            timestamp: block.timestamp,
            orderId: orderId
        }));
        
        emit PaymentSplit(orderId, merchant, token, amount, merchantAmount, feeAmount);
    }
    
    /**
     * @notice Process payment that was sent directly to this contract
     * @dev Call this after swap provider sends tokens to this contract
     */
    function processDirectPayment(
        address merchant,
        address token,
        bytes32 orderId
    ) external nonReentrant {
        require(merchant != address(0), "Invalid merchant");
        require(supportedTokens[token], "Token not supported");
        require(!processedOrders[orderId], "Order already processed");
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to process");
        
        // Mark order as processed
        processedOrders[orderId] = true;
        
        // Calculate split
        uint256 feeAmount = (balance * feeBasisPoints) / 10000;
        uint256 merchantAmount = balance - feeAmount;
        
        // Send to merchant (99%)
        IERC20(token).safeTransfer(merchant, merchantAmount);
        
        // Send to fee wallet (1%)
        IERC20(token).safeTransfer(feeWallet, feeAmount);
        
        // Record payment
        payments.push(Payment({
            merchant: merchant,
            token: token,
            grossAmount: balance,
            merchantAmount: merchantAmount,
            feeAmount: feeAmount,
            timestamp: block.timestamp,
            orderId: orderId
        }));
        
        emit PaymentSplit(orderId, merchant, token, balance, merchantAmount, feeAmount);
    }
    
    // Admin functions
    
    function setFeeWallet(address _feeWallet) external onlyOwner {
        require(_feeWallet != address(0), "Invalid fee wallet");
        address oldWallet = feeWallet;
        feeWallet = _feeWallet;
        emit FeeWalletUpdated(oldWallet, _feeWallet);
    }
    
    function setFeeBasisPoints(uint256 _feeBasisPoints) external onlyOwner {
        require(_feeBasisPoints <= 1000, "Fee too high (max 10%)");
        uint256 oldBps = feeBasisPoints;
        feeBasisPoints = _feeBasisPoints;
        emit FeeBasisPointsUpdated(oldBps, _feeBasisPoints);
    }
    
    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }
    
    function getPaymentCount() external view returns (uint256) {
        return payments.length;
    }
    
    function getPayment(uint256 index) external view returns (Payment memory) {
        require(index < payments.length, "Index out of bounds");
        return payments[index];
    }
    
    // Emergency withdrawal (owner only)
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
