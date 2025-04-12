// src/services/zoraService.ts
import { createCoin, getCoinCreateFromLogs } from "@zoralabs/coins-sdk";
import { Hex, createWalletClient, createPublicClient, http, Address } from "viem";
import { base, baseSepolia } from "viem/chains";
import axios from 'axios';

// Simple function to check if an address is valid
const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Create a coin based on contract analysis
export const createZoraCoin = async (
  account: string,
  rpcUrl: string,
  name: string,
  symbol: string,
  uri: string
) => {
  try {
    console.log(`Creating Zora coin with:
      - Name: ${name}
      - Symbol: ${symbol}
      - URI: ${uri}
      - Creator: ${account}
      - RPC URL: ${rpcUrl}
    `);
    
    // For hackathon purposes, we'll use a mock implementation
    // This allows you to demonstrate the UI flow without requiring
    // actual blockchain transactions
    
    // Simulate a delay to mimic transaction processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate a realistic-looking address based on the coin name and symbol
    // This is just for demo purposes
    const nameHash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const symbolHash = Array.from(symbol).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const mockAddress = `0x${(nameHash + symbolHash).toString(16).padStart(40, '0')}`;
    
    // Mock transaction hash - would be returned by the blockchain
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 64)}`;
    
    // Return a structure that matches what the Zora SDK would return
    return {
      address: mockAddress,
      hash: mockTxHash,
      deployment: {
        tokenId: Math.floor(Math.random() * 1000)
      }
    };
    
    /* REAL IMPLEMENTATION - For production use
    
    // Validate inputs
    if (!isValidAddress(account)) {
      throw new Error("Invalid creator address");
    }
    
    // Set the chain based on the RPC URL
    const chain = rpcUrl.includes('sepolia') ? baseSepolia : base;
    
    // Create the public client for reading from the blockchain
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
    
    // Create the wallet client for writing to the blockchain
    const walletClient = createWalletClient({
      account: account as Hex,
      chain,
      transport: http(rpcUrl),
    });
    
    // Set up the coin parameters based on the Zora SDK requirements
    const coinParams = {
      name,                                  // The name of your coin
      symbol,                                // Trading symbol for your coin
      uri,                                   // Metadata URI (IPFS recommended)
      payoutRecipient: account as Address,   // Address to receive creator earnings
      initialPurchaseWei: BigInt(0),         // No initial purchase for the demo
    };
    
    // Create the coin using the Zora SDK
    const result = await createCoin(coinParams, walletClient, publicClient);
    return result;
    */
  } catch (error) {
    console.error("Error creating Zora coin:", error);
    throw error;
  }
};

// Get coin information from the Zora API
export const getCoinInfo = async (address: string, chainId: number = 8453) => {
  try {
    // This would call the Zora SDK API to get information about a coin
    // Using the endpoint https://api-sdk.zora.engineering/coin
    
    // For the hackathon, we'll just return mock data
    // In production, uncomment the API call below
    
    /*
    const response = await axios.get('https://api-sdk.zora.engineering/coin', {
      params: {
        address,
        chain: chainId
      }
    });
    
    return response.data.zora20Token;
    */
    
    // Mock data for demonstration
    return {
      id: `zora-${address}`,
      name: "Example Coin",
      description: "This is an example coin created with the Zora SDK",
      address: address,
      symbol: "DEMO",
      totalSupply: "1000000000000000000000000",
      totalVolume: "0",
      volume24h: "0",
      createdAt: new Date().toISOString(),
      creatorAddress: "0x123456789abcdef0123456789abcdef012345678",
      marketCap: "0",
      chainId: chainId,
      uniqueHolders: 1
    };
  } catch (error) {
    console.error("Error getting coin info:", error);
    throw error;
  }
};

// Function to format an IPFS URI for use with Zora
export const formatIPFSUri = (hash: string): string => {
  // Remove ipfs:// prefix if it exists
  const cleanHash = hash.replace(/^ipfs:\/\//, '');
  // Return properly formatted IPFS URI
  return `ipfs://${cleanHash}`;
};