import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { InjectedConnector } from '@web3-react/injected-connector';
import { useWeb3React } from '@web3-react/core';
import { base, baseSepolia } from 'viem/chains';

// Define supported chain IDs
const SUPPORTED_CHAIN_IDS = [1,421614, 137, 42161, 10, 8453, 84532]; // Mainnet, Sepolia, Arbitrum Sepolia, Base, Base Sepolia for Zora

// Create injected connector
export const injectedConnector = new InjectedConnector({
  supportedChainIds: SUPPORTED_CHAIN_IDS,
});

// Define the context shape
interface Web3ContextType {
  account: string | null;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isActive: boolean;
  library: ethers.providers.Web3Provider | null;
  balance: string;
  isConnecting: boolean;
  error: Error | null;
  getChainName: (chainId: number) => string;
}

const Web3Context = createContext<Web3ContextType>({
  account: null,
  chainId: null,
  connect: async () => {},
  disconnect: () => {},
  isActive: false,
  library: null,
  balance: '0',
  isConnecting: false,
  error: null,
  getChainName: () => '',
});

export const useWeb3 = () => useContext(Web3Context);

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activate, deactivate, account, chainId, library, active, error } = useWeb3React<ethers.providers.Web3Provider>();
  const [balance, setBalance] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);

  // Network names
  const getChainName = (chainId: number): string => {
    const chainNames: Record<number, string> = {
      1: 'Ethereum',
      11155111: 'Sepolia',
      137: 'Polygon',
      42161: 'Arbitrum',
      10: 'Optimism',
      8453: 'Base', 
      84532: 'Base Sepolia',
    };
    return chainNames[chainId] || `Chain #${chainId}`;
  };

  // Connect to wallet - using useCallback to memoize the function
  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await activate(injectedConnector);
    } catch (error) {
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [activate]);

  // Disconnect wallet
  const disconnect = () => {
    deactivate();
  };

  // Get balance when account changes
  useEffect(() => {
    if (account && library) {
      library.getBalance(account).then((balance: ethers.BigNumber) => {
        setBalance(ethers.utils.formatEther(balance));
      }).catch(error => {
        console.error('Error fetching balance:', error);
        setBalance('0');
      });
    } else {
      setBalance('0');
    }
  }, [account, library, chainId]);

  // Auto-connect if previously connected
  useEffect(() => {
    injectedConnector.isAuthorized().then((isAuthorized) => {
      if (isAuthorized) {
        connect();
      }
    }).catch(error => {
      console.error('Authorization check error:', error);
    });
  }, [connect]); // Added connect as a dependency

  return (
    <Web3Context.Provider
      value={{
        account: account || null,
        chainId: chainId || null,
        connect,
        disconnect,
        isActive: active,
        library: library || null,
        balance,
        isConnecting,
        error: error || null,
        getChainName,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};