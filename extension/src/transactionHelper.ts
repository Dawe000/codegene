import { ethers } from 'ethers';
import * as hardhatService from './hardhatService';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWorkspacePath } from './fileUtils';

// Provider for Ethereum connection
let provider: ethers.JsonRpcProvider | null = null;

/**
 * Gets the Ethereum provider
 */
export function getProvider(): ethers.JsonRpcProvider {
  return hardhatService.getProvider();
}

/**
 * Gets the default signer (alias for hardhatService.getSigner(0))
 */
export function getDefaultSigner(): ethers.Wallet {
  return hardhatService.getSigner(0);
}

/**
 * Gets a signer for the specified account index
 * @param accountIndex Index of the account to use (0-9)
 * @returns Signer object
 */
export function getSigner(accountIndex: number = 0): ethers.Wallet {
  return hardhatService.getSigner(accountIndex);
}

/**
 * Gets a contract instance by name
 * @param contractName Name of the deployed contract
 * @param signer Optional signer to connect with the contract
 * @returns Contract instance or null if not found
 */
export async function getContract(
  contractName: string, 
  signer?: ethers.Wallet
): Promise<ethers.Contract | null> {
  try {
    // Get an existing deployed contract
    return await hardhatService.getDeployedContract(contractName, signer);
  } catch (error) {
    console.error(`Error getting contract: ${(error as any).message}`);
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
    const wallet = options.wallet || getDefaultSigner();
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
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
      return [];
    }
    
    const deploymentInfo = await hardhatService.getDeploymentInfo(workspacePath);
    return deploymentInfo.contractNames.map(name => ({
      name,
      address: deploymentInfo.contractAddresses[name]
    }));
  } catch (error: any) {
    console.error(`Error getting contracts: ${error.message}`);
    return [];
  }
}

/**
 * Gets all available accounts
 */
export function getAllAccounts(): {privateKey: string, address: string}[] {
  return hardhatService.DEFAULT_ACCOUNTS;
}

/**
 * Simplified contract interaction - this is the main function for tests to use!
 * @param options Configuration options for the contract interaction
 */
export async function testContract(options: {
  contractName: string;           // Name of the contract to deploy
  constructorArgs?: any[];        // Constructor arguments if deploying
  attackerIndex?: number;         // Index of attacker account (0-4)
  ownerIndex?: number;            // Index of owner account (0-4)
  userIndex?: number;             // Index of regular user account (0-4)
  etherToSend?: string;           // Ether to send to the contract after deployment
  useExistingContract?: boolean;  // Whether to use an existing deployment
  attackLogic: (context: TestContext) => Promise<any>; // Attack function to run
}): Promise<TestResult> {
  try {
    console.log(`🧪 Testing ${options.contractName}...`);
    
    // Set up accounts using hardhatService functions
    const ownerIndex = options.ownerIndex ?? 0;
    const attackerIndex = options.attackerIndex ?? 1;
    const userIndex = options.userIndex ?? 2;
    
    const owner = hardhatService.getSigner(ownerIndex);
    const attacker = hardhatService.getSigner(attackerIndex);
    const user = hardhatService.getSigner(userIndex);
    
    console.log(`👑 Owner: ${await owner.getAddress()}`);
    console.log(`🦹 Attacker: ${await attacker.getAddress()}`);
    console.log(`👤 User: ${await user.getAddress()}`);
    
    // Get shared provider instance from hardhatService
    const provider = hardhatService.getProvider();
    
    // Get initial balances
    const initialOwnerBalance = await provider.getBalance(await owner.getAddress());
    const initialAttackerBalance = await provider.getBalance(await attacker.getAddress());
    const initialUserBalance = await provider.getBalance(await user.getAddress());
    
    // Deploy or get existing contract
    let contract: ethers.Contract;
    
    if (options.useExistingContract) {
      console.log(`🔍 Getting existing contract ${options.contractName}...`);
      contract = await hardhatService.getDeployedContract(options.contractName, owner);
    } else {
      console.log(`🚀 Deploying new ${options.contractName}...`);
      contract = await hardhatService.deployContract(
        options.contractName,
        options.constructorArgs || [],
        owner
      );
    }
    
    const contractAddress = await contract.getAddress();
    console.log(`📄 Contract address: ${contractAddress}`);
    
    // Send ether to contract if specified
    if (options.etherToSend) {
      const etherAmount = ethers.parseEther(options.etherToSend);
      console.log(`💰 Sending ${options.etherToSend} ETH to contract...`);
      
      const tx = await owner.sendTransaction({
        to: contractAddress,
        value: etherAmount
      });
      
      await tx.wait();
      console.log(`✅ ETH sent, transaction: ${tx.hash}`);
    }
    
    // Create test context
    const context: TestContext = {
      contract,
      owner: { signer: owner, address: await owner.getAddress() },
      attacker: { signer: attacker, address: await attacker.getAddress() },
      user: { signer: user, address: await user.getAddress() },
      contractAddress,
      provider
    };
    
    // Run attack logic
    console.log(`⚔️ Executing attack logic...`);
    const attackResult = await options.attackLogic(context);
    
    // Get final balances
    const finalOwnerBalance = await provider.getBalance(await owner.getAddress());
    const finalAttackerBalance = await provider.getBalance(await attacker.getAddress());
    const finalUserBalance = await provider.getBalance(await user.getAddress());
    
    // Get contract balance
    const contractBalance = await provider.getBalance(contractAddress);
    
    // Prepare result
    return {
      success: true,
      contractAddress,
      balanceChanges: {
        owner: {
          initial: ethers.formatEther(initialOwnerBalance),
          final: ethers.formatEther(finalOwnerBalance),
          change: ethers.formatEther(finalOwnerBalance - initialOwnerBalance)
        },
        attacker: {
          initial: ethers.formatEther(initialAttackerBalance),
          final: ethers.formatEther(finalAttackerBalance),
          change: ethers.formatEther(finalAttackerBalance - initialAttackerBalance)
        },
        user: {
          initial: ethers.formatEther(initialUserBalance),
          final: ethers.formatEther(finalUserBalance),
          change: ethers.formatEther(finalUserBalance - initialUserBalance)
        },
        contract: ethers.formatEther(contractBalance)
      },
      attackResult
    };
  } catch (error: any) {
    console.error(`❌ Test failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Helper function to create a contract that can be used as a malicious attacker contract
 * @param source Full Solidity source code of the attacker contract
 * @param constructorArgs Constructor arguments for the attacker contract
 * @param attackerSigner Optional attacker signer (defaults to account 1)
 */
export async function deployAttackerContract(
  source: string,
  constructorArgs: any[] = [],
  attackerSigner?: ethers.Wallet
): Promise<ethers.Contract> {
  try {
    // Extract contract name from source
    const nameMatch = source.match(/contract\s+(\w+)/);
    if (!nameMatch) {
      throw new Error("Could not determine contract name from source");
    }
    
    const contractName = nameMatch[1];
    const workspacePath = getWorkspacePath();
    
    if (!workspacePath) {
      throw new Error("No workspace folder open");
    }
    
    // Create contracts directory if it doesn't exist
    const contractsDir = path.join(workspacePath, 'contracts');
    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir, { recursive: true });
    }
    
    // Write the contract to a file
    const filePath = path.join(contractsDir, `${contractName}.sol`);
    fs.writeFileSync(filePath, source);
    
    console.log(`📝 Attacker contract written to ${filePath}`);
    
    // Get the appropriate signer
    const signer = attackerSigner || getSigner(1); // Default to account 1 (attacker)
    
    // Deploy the contract
    return await hardhatService.deployContract(contractName, constructorArgs, signer);
  } catch (error: any) {
    console.error(`Error deploying attacker contract: ${error.message}`);
    throw error;
  }
}

/**
 * Helper function to monitor events emitted by a contract
 */
export function monitorEvents(contract: ethers.Contract): void {
  contract.on('*', (event) => {
    console.log(`📊 Event emitted: ${event.eventName}`);
    console.log(event.args);
  });
}

// Test context interface
export interface TestContext {
  contract: ethers.Contract;
  owner: { signer: ethers.Wallet; address: string };
  attacker: { signer: ethers.Wallet; address: string };
  user: { signer: ethers.Wallet; address: string };
  contractAddress: string;
  provider: ethers.Provider;
}

// Test result interface
export interface TestResult {
  success: boolean;
  contractAddress?: string;
  balanceChanges?: {
    owner: { initial: string; final: string; change: string };
    attacker: { initial: string; final: string; change: string };
    user: { initial: string; final: string; change: string };
    contract: string;
  };
  attackResult?: any;
  error?: string;
}