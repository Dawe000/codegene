// src/services/ipfsService.ts
import axios from 'axios';

// Constants for working with Pinata - in production, use environment variables
const PINATA_API_KEY = process.env.REACT_APP_PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.REACT_APP_PINATA_SECRET_KEY || '';

/**
 * Pins JSON metadata to IPFS using Pinata
 * @param metadata The metadata to pin to IPFS
 * @returns The IPFS URI of the pinned content
 */
export const pinJSONToIPFS = async (metadata: any): Promise<string> => {
  try {
    // If no API keys are provided, return a placeholder URI
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      console.warn('No Pinata API keys provided, using placeholder IPFS URI');
      return `ipfs://bafkreigoxzqzbnxsn35vq7lls3ljxdcwjafxvbvkivprsodzrptpiguy${Date.now().toString()}`;
    }
    
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      metadata,
      {
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        }
      }
    );
    
    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error('Error pinning to IPFS:', error);
    
    // Return a placeholder URI in case of error
    return `ipfs://bafkreigoxzqzbnxsn35vq7lls3ljxdcwjafxvbvkivprsodzrptpiguy${Date.now().toString()}`;
  }
};

/**
 * Generates Zora coin metadata based on contract analysis
 * @param name The name of the coin
 * @param symbol The symbol of the coin
 * @param contractAnalysis Analysis of the contract
 * @returns Metadata for the Zora coin
 */
export const generateTokenMetadata = (
  name: string,
  symbol: string,
  contractAnalysis: any
) => {
  // Generate description based on analysis
  const securityScore = contractAnalysis?.overall_score || 75;
  const riskLevel = securityScore > 80 ? 'low' : securityScore > 60 ? 'medium' : 'high';
  
  // Create token metadata following the Zora metadata standards
  return {
    name,
    symbol,
    description: `AI-generated token by CodeGene based on smart contract analysis. Security score: ${securityScore}/100. Risk level: ${riskLevel}.`,
    image: "https://codegene.ai/token-image.png", // Replace with your generated image URL
    external_link: "https://codegene.ai",
    properties: {
      security_score: securityScore,
      risk_level: riskLevel,
      complexity_score: contractAnalysis?.complexity?.score || 70,
      vulnerability_score: contractAnalysis?.vulnerabilities?.score || 80,
      analysis_date: new Date().toISOString()
    },
    attributes: [
      {
        trait_type: "Security Score",
        value: securityScore
      },
      {
        trait_type: "Risk Level",
        value: riskLevel
      }
    ]
  };
};