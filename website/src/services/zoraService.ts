// src/services/zoraService.ts - Fixed version for BigInt issue
import { createCoin, getCoinCreateFromLogs } from '@zoralabs/coins-sdk';
import { createWalletClient, createPublicClient, http, Address, Hex } from 'viem';
import { base } from 'viem/chains';

// Setup clients for Zora Coins
export const getZoraClients = (account: string, rpcUrl: string) => {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
  
  const walletClient = createWalletClient({
    account: account as Hex,
    chain: base,
    transport: http(rpcUrl),
  });
  
  return { publicClient, walletClient };
};

// Create a coin based on contract analysis
export const createZoraCoin = async (
  account: string,
  rpcUrl: string,
  name: string,
  symbol: string,
  uri: string
) => {
  const { publicClient, walletClient } = getZoraClients(account, rpcUrl);
  
  const coinParams = {
    name,
    symbol,
    uri,
    payoutRecipient: account as Address,
    // Use BigInt(0) to create a proper bigint value
    initialPurchaseWei: BigInt(0)
  };
  
  try {
    const result = await createCoin(coinParams, walletClient, publicClient);
    return result;
  } catch (error) {
    console.error("Error creating Zora coin:", error);
    throw error;
  }
};

// Enhanced function to generate coin metadata based on contract analysis
export const generateCoinMetadataFromContract = async (contractAnalysis: any) => {
  // Implementation remains the same
  const securityLevel = contractAnalysis.overall_score > 80 ? 'Safe' : 
                       contractAnalysis.overall_score > 60 ? 'Secure' : 'Flex';
  
  return {
    name: `CodeGene ${securityLevel} Token`,
    symbol: `CG${securityLevel.substring(0, 1)}`,
    riskScore: contractAnalysis.overall_score,
    recommended: {
      initialSupply: 1000000,
      maxSupply: 10000000,
      distribution: [
        { name: 'Creators', percentage: 30 },
        { name: 'Community', percentage: 40 },
        { name: 'Reserves', percentage: 30 }
      ]
    }
  };
};