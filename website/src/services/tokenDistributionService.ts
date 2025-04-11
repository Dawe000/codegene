// src/services/tokenDistributionService.ts
import { ethers } from 'ethers';

// ERC20 ABI - only functions we need
const ERC20_ABI = [
  // Read functions
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  // Write functions
  "function transfer(address to, uint amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  // Events
  "event Transfer(address indexed from, address indexed to, uint amount)"
];

export interface Recipient {
  address: string;
  amount: string;
}

export const distributeTokens = async (
  provider: ethers.providers.Web3Provider,
  tokenAddress: string,
  recipients: Recipient[]
) => {
  try {
    // Get the signer
    const signer = provider.getSigner();
    
    // Create contract instance
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    
    // Get token decimals for proper amount calculation
    const decimals = await tokenContract.decimals();
    
    // For a small number of recipients, we can do individual transfers
    // For larger batches, a multicall contract would be more efficient
    if (recipients.length <= 5) {
      // Do individual transfers
      const txPromises = recipients.map(recipient => {
        const amountWithDecimals = ethers.utils.parseUnits(recipient.amount, decimals);
        return tokenContract.transfer(recipient.address, amountWithDecimals);
      });
      
      // Execute all transfers
      const transactions = await Promise.all(txPromises);
      
      // Wait for all transactions to be mined
      const receipts = await Promise.all(transactions.map(tx => tx.wait()));
      
      return {
        success: true,
        receipts,
        hash: receipts[0].transactionHash // Return the first tx hash
      };
    } else {
      // For demo purposes, let's just do the first 5
      // In a real app, you'd implement batching with a multicall contract
      const warningMsg = `Warning: Only distributing to the first 5 recipients. In production, use batching for large distributions.`;
      console.warn(warningMsg);
      
      const limitedRecipients = recipients.slice(0, 5);
      const txPromises = limitedRecipients.map(recipient => {
        const amountWithDecimals = ethers.utils.parseUnits(recipient.amount, decimals);
        return tokenContract.transfer(recipient.address, amountWithDecimals);
      });
      
      const transactions = await Promise.all(txPromises);
      const receipts = await Promise.all(transactions.map(tx => tx.wait()));
      
      return {
        success: true,
        receipts,
        hash: receipts[0].transactionHash,
        warning: warningMsg
      };
    }
  } catch (error) {
    console.error("Error distributing tokens:", error);
    throw error;
  }
};

// Helper function to get token details
export const getTokenDetails = async (
  provider: ethers.providers.Web3Provider,
  tokenAddress: string
) => {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.decimals(),
      tokenContract.totalSupply()
    ]);
    
    return {
      name,
      symbol,
      decimals,
      totalSupply: ethers.utils.formatUnits(totalSupply, decimals)
    };
  } catch (error) {
    console.error("Error getting token details:", error);
    throw error;
  }
};