import { ethers } from 'ethers';
import * as hardhatService from './hardhatService';
import * as vscode from 'vscode';

// Provider for Ethereum connection
let provider: ethers.JsonRpcProvider | null = null;

/**
 * Initializes the Ethereum provider
 */
export function initProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    const nodeInfo = hardhatService.getNodeInfo();
    provider = new ethers.JsonRpcProvider(nodeInfo.url);
  }
  return provider;
}

/**
 * Creates a wallet from private key
 */
export function createWallet(privateKey: string): ethers.Wallet {
  const provider = initProvider();
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Gets the default account wallet
 */
export function getDefaultWallet(): ethers.Wallet {
  const accounts = hardhatService.DEFAULT_ACCOUNTS;
  return createWallet(accounts[0].privateKey);
}

/**
 * Gets a contract instance
 */
export async function getContract(
  contractName: string, 
  signerOrProvider: ethers.Wallet | ethers.Provider = getDefaultWallet()
): Promise<ethers.Contract | null> {
  try {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      vscode.window.showErrorMessage('No workspace folder is open');
      return null;
    }
    
    const deploymentInfo = await hardhatService.getDeploymentInfo(workspacePath);
    
    if (!deploymentInfo.contractNames.includes(contractName)) {
      vscode.window.showErrorMessage(`Contract "${contractName}" not found in deployments`);
      return null;
    }
    
    const contractAddress = deploymentInfo.contractAddresses[contractName];
    const contractAbi = deploymentInfo.contractAbis[contractName];
    
    return new ethers.Contract(contractAddress, contractAbi, signerOrProvider);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Error getting contract: ${error.message}`);
    return null;
  }
}

/**
 * Executes a transaction on a contract
 */
export async function executeTransaction(
  contractName: string,
  methodName: string,
  params: any[] = [],
  options: {
    value?: string;
    gasLimit?: number;
    wallet?: ethers.Wallet;
  } = {}
): Promise<ethers.TransactionResponse | null> {
  try {
    const wallet = options.wallet || getDefaultWallet();
    const contract = await getContract(contractName, wallet);
    
    if (!contract) {
      throw new Error(`Contract ${contractName} not found`);
    }
    
    if (typeof contract[methodName] !== 'function') {
      throw new Error(`Method ${methodName} not found on contract ${contractName}`);
    }
    
    // Create transaction options
    const txOptions: {[key: string]: any} = {};
    if (options.value) {
      txOptions.value = ethers.parseEther(options.value);
    }
    if (options.gasLimit) {
      txOptions.gasLimit = options.gasLimit;
    }
    
    // Execute the transaction
    const tx = await contract[methodName](...params, txOptions);
    return tx;
  } catch (error: any) {
    vscode.window.showErrorMessage(`Transaction failed: ${error.message}`);
    return null;
  }
}

/**
 * Gets all available contracts from the deployment
 */
export async function getAllContracts(): Promise<{name: string, address: string}[]> {
  try {
    const transactionInfo = await hardhatService.getTransactionInfo();
    return transactionInfo.contracts.map(c => ({
      name: c.name,
      address: c.address
    }));
  } catch (error: any) {
    vscode.window.showErrorMessage(`Error getting contracts: ${error.message}`);
    return [];
  }
}

/**
 * Gets all available accounts
 */
export function getAllAccounts(): {privateKey: string, address: string}[] {
  return hardhatService.DEFAULT_ACCOUNTS;
}