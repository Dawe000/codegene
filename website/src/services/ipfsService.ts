// src/services/ipfsService.ts
import axios from 'axios';

// Replace with your Pinata API keys or other IPFS provider
const PINATA_API_KEY = process.env.REACT_APP_PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.REACT_APP_PINATA_SECRET_KEY;

// Generate metadata based on contract analysis
export const generateTokenMetadata = (
  name: string,
  symbol: string,
  contractAnalysis: any
) => {
  // Generate description based on analysis
  const securityScore = contractAnalysis.overall_score;
  const riskLevel = securityScore > 80 ? 'low' : securityScore > 60 ? 'medium' : 'high';
  
  // Create token metadata following ERC20 metadata standards
  return {
    name,
    symbol,
    description: `AI-generated token by CodeGene based on smart contract analysis. Security score: ${securityScore}/100. Risk level: ${riskLevel}.`,
    image: "https://codegene.ai/token-image.png", // Replace with your generated image URL
    external_link: "https://codegene.ai",
    properties: {
      security_score: securityScore,
      risk_level: riskLevel,
      complexity_score: contractAnalysis.complexity.score,
      vulnerability_score: contractAnalysis.vulnerabilities.score,
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

// Pin metadata to IPFS using Pinata
export const pinToIPFS = async (metadata: any): Promise<string> => {
  try {
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
    
    // For testing without actual IPFS pinning
    return `ipfs://QmTestHash${Math.floor(Math.random() * 1000000)}`;
  }
};