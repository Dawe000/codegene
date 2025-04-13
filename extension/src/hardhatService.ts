import * as vscode from 'vscode';
import { spawn, ChildProcess, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { getWorkspacePath } from './fileUtils';
import { ethers } from 'ethers';

// Store node process and state
let nodeProcess: ChildProcess | null = null;
let isNodeRunning: boolean = false;

// Provider for Ethereum connection - centralized here
let provider: ethers.JsonRpcProvider | null = null;

// Default Hardhat accounts
export const DEFAULT_ACCOUNTS = [
  {
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
  },
  {
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
  },
  {
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
  },
  {
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
  },
  {
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
  }
];

// Provider for Ethereum connection
/**
 * Gets or initializes the ethers provider
 */
export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider('http://localhost:8545');
  }
  return provider;
}

/**
 * Gets a signer for the specified account index
 * @param accountIndex Index of the account to use (0-4)
 * @returns Signer object
 */
export function getSigner(accountIndex: number = 0): ethers.Wallet {
  if (accountIndex < 0 || accountIndex >= DEFAULT_ACCOUNTS.length) {
    throw new Error(`Invalid account index: ${accountIndex}. Must be between 0 and ${DEFAULT_ACCOUNTS.length - 1}`);
  }
  
  const account = DEFAULT_ACCOUNTS[accountIndex];
  return new ethers.Wallet(account.privateKey, getProvider());
}

/**
 * Simplified contract deployment function - handles all the details
 * @param contractName Name of the contract to deploy
 * @param constructorArgs Array of constructor arguments (in order)
 * @param signer Optional signer to use for deployment (defaults to account 0)
 * @returns Deployed contract instance
 */
export async function deployContract(
  contractName: string,
  constructorArgs: any[] = [],
  signer?: ethers.Wallet
): Promise<ethers.Contract> {
  try {
    console.log(`📄 Deploying ${contractName} with ${constructorArgs.length} constructor args`);
    
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
      throw new Error('No workspace folder is open');
    }
    
    // Get account to deploy with
    const deployer = signer || getSigner(0);
    console.log(`🔑 Deploying from account: ${await deployer.getAddress()}`);
    
    // Check if Hardhat artifacts are available
    const artifactsDir = path.join(workspacePath, 'artifacts', 'contracts');
    if (!fs.existsSync(artifactsDir)) {
      console.log('⚙️ Compiling contracts...');
      
      // Compile contracts if artifacts are not found
      execSync('npx hardhat compile', {
        cwd: workspacePath,
        stdio: 'inherit'
      });
    }
    
    // Find the contract artifact
    const contractFiles = findContractArtifact(workspacePath, contractName);
    if (!contractFiles || contractFiles.length === 0) {
      throw new Error(`Contract artifact for ${contractName} not found`);
    }
    
    // Load the contract factory
    const artifactPath = contractFiles[0];
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    
    // Create factory with ABI and bytecode
    const factory = new ethers.ContractFactory(
      artifact.abi,
      artifact.bytecode,
      deployer
    );
    
    // Deploy with constructor arguments
    console.log(`🚀 Deploying ${contractName}...`);
    const contract = (await factory.deploy(...constructorArgs)) as ethers.Contract;
    
    // Wait for deployment to complete
    console.log(`⏳ Waiting for deployment transaction: ${contract.deploymentTransaction()?.hash}`);
    await contract.waitForDeployment();
    
    const address = await contract.getAddress();
    console.log(`✅ ${contractName} deployed to: ${address}`);
    
    // Save deployment info for future reference
    saveDeploymentInfo(workspacePath, contractName, address, artifact.abi, constructorArgs);
    
    return contract;
  } catch (error: any) {
    console.error(`❌ Deployment failed: ${error.message}`);
    throw error;
  }
}

/**
 * Finds a contract artifact in the Hardhat project
 */
function findContractArtifact(workspacePath: string, contractName: string): string[] {
  const artifactsDir = path.join(workspacePath, 'artifacts', 'contracts');
  if (!fs.existsSync(artifactsDir)) {
    return [];
  }
  
  const results: string[] = [];
  
  // Recursive function to search directories
  function searchDir(dir: string) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        searchDir(filePath);
      } else if (file === `${contractName}.json`) {
        results.push(filePath);
      }
    }
  }
  
  searchDir(artifactsDir);
  return results;
}

/**
 * Saves deployment information for future reference
 */
function saveDeploymentInfo(
  workspacePath: string, 
  contractName: string, 
  address: string, 
  abi: any, 
  constructorArgs: any[]
): void {
  try {
    const deploymentsDir = path.join(workspacePath, 'deployments', 'localhost');
    
    // Create deployments directory if it doesn't exist
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    // Create deployment info JSON
    const deploymentInfo = {
      address,
      abi,
      constructorArgs,
      transactionHash: '',
      deployedAt: new Date().toISOString()
    };
    
    const deploymentPath = path.join(deploymentsDir, `${contractName}.json`);
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`📝 Saved deployment info to: ${deploymentPath}`);
  } catch (error) {
    console.error('Error saving deployment info:', error);
  }
}

/**
 * Gets a deployed contract instance
 * @param contractName Name of the deployed contract
 * @param signer Optional signer to use for transactions
 * @returns Contract instance
 */
export async function getDeployedContract(
  contractName: string,
  signer?: ethers.Wallet
): Promise<ethers.Contract> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    throw new Error('No workspace folder is open');
  }
  
  // Check deployments directory
  const deploymentPath = path.join(workspacePath, 'deployments', 'localhost', `${contractName}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment info for ${contractName} not found`);
  }
  
  // Load deployment info
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const signerOrProvider = signer || getProvider();
  
  // Create contract instance
  return new ethers.Contract(
    deploymentInfo.address,
    deploymentInfo.abi,
    signerOrProvider
  );
}

/**
 * Creates and deploys a contract from a string source
 * @param contractSource Full Solidity contract source
 * @param constructorArgs Array of constructor arguments
 * @returns Deployed contract instance
 */
export async function deployContractFromSource(
  contractSource: string,
  constructorArgs: any[] = []
): Promise<ethers.Contract> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    throw new Error('No workspace folder is open');
  }
  
  // Extract contract name from source
  const contractNameMatch = contractSource.match(/contract\s+(\w+)/);
  if (!contractNameMatch) {
    throw new Error('Could not determine contract name from source');
  }
  
  const contractName = contractNameMatch[1];
  
  // Create temporary file
  const contractsDir = path.join(workspacePath, 'contracts');
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }
  
  const contractPath = path.join(contractsDir, `${contractName}.sol`);
  fs.writeFileSync(contractPath, contractSource);
  
  // Compile
  console.log('⚙️ Compiling contract...');
  execSync('npx hardhat compile', {
    cwd: workspacePath,
    stdio: 'inherit'
  });
  
  // Deploy
  return deployContract(contractName, constructorArgs);
}

/**
 * Get Hardhat node connection information
 * @returns Node connection details
 */
export function getNodeInfo(): { url: string, port: number, isRunning: boolean, accounts: any[] } {
  return {
    url: 'http://localhost:8545',
    port: 8545,
    isRunning: isNodeRunning || false,
    accounts: DEFAULT_ACCOUNTS
  };
}

/**
 * Simple placeholder for transaction info until fully implemented
 */
export async function getTransactionInfo(): Promise<{ contracts: { name: string, address: string }[] }> {
  // Placeholder until proper implementation
  return {
    contracts: []
  };
}

/**
 * Gets deployment information for existing contracts
 * @param workspacePath Path to the workspace folder
 * @returns Information about all deployed contracts
 */
export async function getDeploymentInfo(workspacePath: string): Promise<{
  contractNames: string[];
  contractAddresses: {[key: string]: string};
  contractAbis: {[key: string]: any[]};
}> {
  const deploymentsDir = path.join(workspacePath, 'deployments', 'localhost');
  const result = {
    contractNames: [],
    contractAddresses: {},
    contractAbis: {}
  } as {
    contractNames: string[];
    contractAddresses: {[key: string]: string};
    contractAbis: {[key: string]: any[]};
  };
  
  if (!fs.existsSync(deploymentsDir)) {
    return result;
  }
  
  const files = fs.readdirSync(deploymentsDir);
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const contractName = file.replace('.json', '');
      try {
        const deploymentInfo = JSON.parse(fs.readFileSync(path.join(deploymentsDir, file), 'utf8'));
        
        result.contractNames.push(contractName);
        result.contractAddresses[contractName] = deploymentInfo.address;
        result.contractAbis[contractName] = deploymentInfo.abi;
      } catch (error) {
        console.error(`Error reading deployment info for ${contractName}:`, error);
      }
    }
  }
  
  return result;
}

/**
 * Starts a Hardhat node for local development and deploys contracts
 * @param outputChannel VS Code output channel for logging
 * @returns Result with status and message
 */
export async function startNodeAndDeploy(outputChannel: vscode.OutputChannel): Promise<{success: boolean; message: string}> {
  try {
    // Check if node is already running
    if (isNodeRunning && nodeProcess) {
      return { success: true, message: 'Hardhat node already running' };
    }
    
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
      return { success: false, message: 'No workspace folder is open' };
    }
    
    outputChannel.appendLine('\n======== STARTING HARDHAT NODE ========');
    outputChannel.appendLine('Starting Hardhat node in the background...');
    outputChannel.show();
    
    // Start the Hardhat node
    nodeProcess = spawn('npx', ['hardhat', 'node'], {
      cwd: workspacePath,
      shell: true
    });
    
    // Wait for the node to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if node is running by attempting to connect
    const isRunning = await checkNodeRunning();
    if (!isRunning) {
      nodeProcess?.kill();
      nodeProcess = null;
      return { success: false, message: 'Failed to start Hardhat node' };
    }
    
    // Node is running
    isNodeRunning = true;
    
    // Set up event handlers
    if (nodeProcess?.stdout) {
      nodeProcess.stdout.on('data', (data) => {
        const output = data.toString();
        outputChannel.appendLine(output);
      });
    }
    
    if (nodeProcess?.stderr) {
      nodeProcess.stderr.on('data', (data) => {
        const output = data.toString();
        outputChannel.appendLine(`Error: ${output}`);
      });
    }
    
    nodeProcess.on('close', (code) => {
      outputChannel.appendLine(`Hardhat node exited with code ${code}`);
      isNodeRunning = false;
      nodeProcess = null;
    });
    
    return { success: true, message: 'Hardhat node started successfully' };
  } catch (error: any) {
    outputChannel.appendLine(`Error starting Hardhat node: ${error.message}`);
    return { success: false, message: `Error: ${error.message}` };
  }
}

/**
 * Stops the running Hardhat node
 * @returns True if node was stopped, false if no node was running
 */
export function stopNode(): boolean {
  if (isNodeRunning && nodeProcess) {
    try {
      nodeProcess.kill();
      isNodeRunning = false;
      nodeProcess = null;
      console.log('Hardhat node stopped');
      return true;
    } catch (error) {
      console.error('Error stopping Hardhat node:', error);
      return false;
    }
  }
  return false;
}

/**
 * Checks if the Hardhat node is running by attempting to connect
 */
async function checkNodeRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    
    client.once('connect', () => {
      client.end();
      resolve(true);
    });
    
    client.once('error', () => {
      resolve(false);
    });
    
    client.connect(8545, 'localhost');
  });
}