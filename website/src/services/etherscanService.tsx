import axios from 'axios';

export const getContractSource = async (contractAddress: string, network: string = 'mainnet'): Promise<string> => {
  try {
    const baseUrl = network === 'mainnet' 
      ? 'https://api.etherscan.io/api' 
      : `https://api-${network}.etherscan.io/api`;
      
    const response = await axios.get(baseUrl, {
      params: {
        module: 'contract',
        action: 'getsourcecode',
        address: contractAddress,
        apikey: process.env.REACT_APP_ETHERSCAN_API_KEY
      }
    });
    
    if (response.data.status === '1' && response.data.result.length > 0) {
      return response.data.result[0].SourceCode;
    } else {
      throw new Error('Contract source code not found');
    }
  } catch (error) {
    console.error('Error fetching from Etherscan:', error);
    throw new Error('Failed to retrieve contract source code from Etherscan');
  }
};

export const getContractABI = async (contractAddress: string, network: string = 'mainnet'): Promise<any> => {
  try {
    const baseUrl = network === 'mainnet' 
      ? 'https://api.etherscan.io/api' 
      : `https://api-${network}.etherscan.io/api`;
      
    const response = await axios.get(baseUrl, {
      params: {
        module: 'contract',
        action: 'getabi',
        address: contractAddress,
        apikey: process.env.REACT_APP_ETHERSCAN_API_KEY
      }
    });
    
    if (response.data.status === '1') {
      return JSON.parse(response.data.result);
    } else {
      throw new Error('Contract ABI not found');
    }
  } catch (error) {
    console.error('Error fetching ABI from Etherscan:', error);
    throw new Error('Failed to retrieve contract ABI from Etherscan');
  }
};//#todo: add other scan services like basescan or tesnets