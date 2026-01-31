// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SafePaySplitter
 * @notice Automatically splits ERC20 payments between merchants and platform fee wallet
 * @dev Receives stablecoin payments, takes 1% fee, sends 99% to merchant
 */
contract SafePaySplitter is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Address that receives platform fees
    address public feeWallet;
    
    /// @notice Fee in basis points (100 = 1%)
    uint256 public feeBasisPoints;
    
    /// @notice Mapping of supported ERC20 tokens
    mapping(address => bool) public supportedTokens;
    
    /// @notice Mapping of processed order IDs to prevent double-processing
    mapping(bytes32 => bool) public processedOrders;
    
    /// @notice Total amount of tokens processed through the contract
    uint256 public totalProcessed;
    
    /// @notice Total fees collected
    uint256 public totalFeeCollected;

    /// @notice Emitted when a payment is processed
    event PaymentProcessed(
        address indexed merchant,
        address indexed token,
        bytes32 indexed orderId,
        uint256 grossAmount,
        uint256 merchantAmount,
        uint256 feeAmount
    );

    /// @notice Emitted when a token is added/removed from supported list
    event TokenSupportUpdated(address indexed token, bool supported);

    /// @notice Emitted when fee wallet is updated
    event FeeWalletUpdated(address indexed oldWallet, address indexed newWallet);

    /// @notice Emitted when fee basis points is updated
    event FeeBasisPointsUpdated(uint256 oldFee, uint256 newFee);

    /**
     * @notice Constructor
     * @param _feeWallet Address to receive platform fees
     * @param _feeBasisPoints Fee percentage in basis points (100 = 1%)
     */
    constructor(address _feeWallet, uint256 _feeBasisPoints) Ownable(msg.sender) {
        require(_feeWallet != address(0), "Invalid fee wallet");
        require(_feeBasisPoints <= 1000, "Fee too high"); // Max 10%
        
        feeWallet = _feeWallet;
        feeBasisPoints = _feeBasisPoints;
    }

    /**
     * @notice Process a payment - splits between merchant and fee wallet
     * @param merchant Address to receive merchant portion (99%)
     * @param token ERC20 token address
     * @param orderId Unique order identifier to prevent double-processing
     */
    function processPayment(
        address merchant,
        address token,
        bytes32 orderId
    ) external nonReentrant {
        require(merchant != address(0), "Invalid merchant");
        require(supportedTokens[token], "Token not supported");
        require(!processedOrders[orderId], "Order already processed");
        
        // Get contract's token balance
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to process");
        
        // Mark order as processed
        processedOrders[orderId] = true;
        
        // Calculate fee and merchant amounts
        uint256 feeAmount = (balance * feeBasisPoints) / 10000;
        uint256 merchantAmount = balance - feeAmount;
        
        // Update stats
        totalProcessed += balance;
        totalFeeCollected += feeAmount;
        
        // Transfer to merchant (99%)
        IERC20(token).safeTransfer(merchant, merchantAmount);
        
        // Transfer fee to fee wallet (1%)
        if (feeAmount > 0) {
            IERC20(token).safeTransfer(feeWallet, feeAmount);
        }
        
        emit PaymentProcessed(
            merchant,
            token,
            orderId,
            balance,
            merchantAmount,
            feeAmount
        );
    }

    /**
     * @notice Add or remove a token from supported list
     * @param token ERC20 token address
     * @param supported Whether the token is supported
     */
    function setSupportedToken(address token, bool supported) external onlyOwner {
        require(token != address(0), "Invalid token");
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }

    /**
     * @notice Update the fee wallet address
     * @param _feeWallet New fee wallet address
     */
    function setFeeWallet(address _feeWallet) external onlyOwner {
        require(_feeWallet != address(0), "Invalid fee wallet");
        address oldWallet = feeWallet;
        feeWallet = _feeWallet;
        emit FeeWalletUpdated(oldWallet, _feeWallet);
    }

    /**
     * @notice Update the fee percentage
     * @param _feeBasisPoints New fee in basis points
     */
    function setFeeBasisPoints(uint256 _feeBasisPoints) external onlyOwner {
        require(_feeBasisPoints <= 1000, "Fee too high"); // Max 10%
        uint256 oldFee = feeBasisPoints;
        feeBasisPoints = _feeBasisPoints;
        emit FeeBasisPointsUpdated(oldFee, _feeBasisPoints);
    }

    /**
     * @notice Emergency withdrawal of tokens (only owner)
     * @param token ERC20 token address
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @notice Check if an order has been processed
     * @param orderId Order ID to check
     */
    function isOrderProcessed(bytes32 orderId) external view returns (bool) {
        return processedOrders[orderId];
    }

    /**
     * @notice Get contract statistics
     */
    function getStats() external view returns (
        uint256 _totalProcessed,
        uint256 _totalFeeCollected,
        address _feeWallet,
        uint256 _feeBasisPoints
    ) {
        return (totalProcessed, totalFeeCollected, feeWallet, feeBasisPoints);
    }
}
