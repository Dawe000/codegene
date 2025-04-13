// src/services/zoraService.ts
import { createCoin, getCoinCreateFromLogs } from "@zoralabs/coins-sdk";
import { Hex, createWalletClient, createPublicClient, http, Address, parseEther } from "viem";
import { base, baseSepolia } from "viem/chains";

/**
 * Creates a new Zora coin
 * @param account The account address creating the coin
 * @param rpcUrl The RPC URL for the network
 * @param name The name of the coin
 * @param symbol The symbol of the coin
 * @param uri The metadata URI for the coin
 * @param initialPurchaseEth Optional initial purchase amount in ETH
 * @returns The result of creating the coin
 */
export const createZoraCoin = async (
  account: string,
  rpcUrl: string,
  name: string,
  symbol: string,
  uri: string,
  initialPurchaseEth?: string
) => {
  try {
    console.log(`Creating Zora coin with:
      - Name: ${name}
      - Symbol: ${symbol}
      - URI: ${uri}
      - Creator: ${account}
      - RPC URL: ${rpcUrl}
      - Initial Purchase: ${initialPurchaseEth || '0'} ETH
    `);
    
    // Set the chain based on the RPC URL
    const chain = rpcUrl.includes('mainnet') ? base : base;
    
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
      name,                                   // The name of the coin
      symbol,                                 // Trading symbol for the coin
      uri,                                    // Metadata IPFS 
      payoutRecipient: account as Address,    // Address to receive creator earnings
      platformReferrer: account as Address,   // Address that receives referral fees
      initialPurchaseWei: initialPurchaseEth ? parseEther(initialPurchaseEth) : BigInt(0), // Initial purchase amount
    };
    
    // Create the coin using the Zora SDK
    const result = await createCoin(coinParams, walletClient, publicClient);
    
    console.log("Coin created successfully:", result);
    return result;
  } catch (error) {
    console.error("Error creating Zora coin:", error);
    throw error;
  }
};

/**
 * Formats an IPFS URI for use with Zora
 * @param hash The IPFS hash or URI
 * @returns A properly formatted IPFS URI
 */
export const formatIPFSUri = (hash: string): string => {
  // Remove ipfs:// prefix if it exists
  const cleanHash = hash.replace(/^ipfs:\/\//, '');
  // Return properly formatted IPFS URI
  return `ipfs://${cleanHash}`;
};

/**
 * Creates metadata for a Zora coin
 * @param name The name of the coin
 * @param symbol The symbol of the coin
 * @param description A description of the coin
 * @param imageUrl Optional image URL for the coin
 * @returns Metadata object for the coin
 */
export const createCoinMetadata = (
  name: string,
  symbol: string,
  description: string,
  imageUrl?: string
) => {
  return {
    name,
    symbol,
    description,
    image: imageUrl || "https://github.com/Dawe000/codegene/blob/main/website/public/codegene_logo.png",
    external_link: "https://codegene.ai",
    attributes: [
      {
        trait_type: "Created By Ojas and Dawid",
        value: "CodeGene"
      }
    ]
  };
};

/**
 * Generates a placeholder IPFS URI for testing
 * In a production environment, you would upload the metadata to IPFS
 * @param symbol The symbol of the coin
 * @returns A placeholder IPFS URI
 */
export const generatePlaceholderUri = (symbol: string): string => {
  // This is a placeholder for testing
  // In production, you would upload metadata to IPFS using a service like Pinata
  return `ipfs://bafkreigoxzqzbnxsn35vq7lls3ljxdcwjafxvbvkivprsodzrptpiguys${symbol.toLowerCase()}`;
};