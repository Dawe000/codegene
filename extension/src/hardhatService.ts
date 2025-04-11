import * as vscode from 'vscode';
import { spawn, ChildProcess, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { getWorkspacePath } from './fileUtils';

// Store node process and state
let nodeProcess: ChildProcess | null = null;
let isNodeRunning: boolean = false;

// Default Hardhat accounts - these are always available when running a local node
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

// Interface for node info
export interface NodeInfo {
  url: string;
  accounts: typeof DEFAULT_ACCOUNTS;
  isRunning: boolean;
}

// Interface for contract info
export interface ContractInfo {
  name: string;
  address: string;
  abi: any;
}

// Interface for deployment result
export interface DeploymentResult {
  success: boolean;
  message: string;
  nodeInfo?: NodeInfo;
  contracts?: ContractInfo[];
}

// Check if a port is in use
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        server.close();
        resolve(false);
      })
      .listen(port);
  });
}

/**
 * Gets the current Hardhat node information 
 */
export function getNodeInfo(): NodeInfo {
  return {
    url: 'http://localhost:8545',
    accounts: DEFAULT_ACCOUNTS,
    isRunning: isNodeActive()
  };
}

/**
 * Starts a Hardhat node and deploys contracts
 * @param outputChannel VSCode output channel for logging
 * @returns Promise with deployment result
 */
export async function startNodeAndDeploy(outputChannel: vscode.OutputChannel): Promise<DeploymentResult> {
  try {
    // Check if workspace is open
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
      return { success: false, message: 'No workspace folder is open' };
    }

    // Check for Hardhat project
    const hasHardhatConfig = fs.existsSync(path.join(workspacePath, 'hardhat.config.js')) || 
                           fs.existsSync(path.join(workspacePath, 'hardhat.config.ts'));
    
    if (!hasHardhatConfig) {
      return { success: false, message: 'No Hardhat configuration found in workspace' };
    }

    // Step 1: Check if a node is already running
    outputChannel.appendLine("Checking if a node is already running on port 8545...");
    const portInUse = await isPortInUse(8545);
    
    if (portInUse && !isNodeRunning) {
      outputChannel.appendLine("A node is already running on port 8545 (not managed by this extension). Using the existing node.");
      isNodeRunning = true; // Treat external node as running for our purposes
    } else if (portInUse && isNodeRunning) {
      outputChannel.appendLine("A node started by this extension is already running.");
      // Return immediately with node info and any deployed contracts
      const deploymentInfo = await getDeploymentInfo(workspacePath);
      return { 
        success: true, 
        message: 'Node is already running',
        nodeInfo: getNodeInfo(),
        contracts: deploymentInfoToContractArray(deploymentInfo)
      };
    } else {
      // Start a local Hardhat node
      outputChannel.appendLine("Starting local Hardhat node...");
      
      // Kill any existing node process
      if (nodeProcess && !nodeProcess.killed) {
        nodeProcess.kill();
        nodeProcess = null;
      }
      
      // Start new node process
      nodeProcess = spawn("npx", ["hardhat", "node"], {
        cwd: workspacePath,
        shell: true
      });

      isNodeRunning = true;

      // Set up logging
      nodeProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        outputChannel.appendLine(output);
      });
      
      nodeProcess.stderr?.on('data', (data) => {
        outputChannel.appendLine(`Error: ${data}`);
      });
      
      nodeProcess.on('close', (code) => {
        outputChannel.appendLine(`Node process exited with code ${code}`);
        isNodeRunning = false;
        nodeProcess = null;
      });

      // Wait for node to start up
      outputChannel.appendLine("Waiting for node to initialize (5 seconds)...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Step 2: Deploy the contracts
    outputChannel.appendLine("Deploying contracts...");
    
    try {
      // Check if hardhat-deploy is being used
      const hasHardhatDeploy = fs.existsSync(path.join(workspacePath, 'deploy')) &&
                            fs.readdirSync(path.join(workspacePath, 'deploy')).length > 0;
      
      if (hasHardhatDeploy) {
        // Use hardhat-deploy
        outputChannel.appendLine("Using hardhat-deploy for deployment...");
        execSync("npx hardhat deploy --network localhost", { 
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: workspacePath,
          env: {
            ...process.env,
            HARDHAT_NETWORK: 'localhost'
          }
        });
      } else {
        // Use regular hardhat deployment
        outputChannel.appendLine("Using standard deployment script...");
        
        // Check for standard scripts
        const scriptsDir = path.join(workspacePath, 'scripts');
        if (fs.existsSync(scriptsDir)) {
          const deployScripts = fs.readdirSync(scriptsDir)
            .filter(file => file.toLowerCase().includes('deploy'));
          
          if (deployScripts.length > 0) {
            // Use the first deploy script found
            const scriptPath = path.join('scripts', deployScripts[0]);
            outputChannel.appendLine(`Running deployment script: ${scriptPath}`);
            
            execSync(`npx hardhat run ${scriptPath} --network localhost`, {
              stdio: ['ignore', 'pipe', 'pipe'],
              cwd: workspacePath,
              env: {
                ...process.env,
                HARDHAT_NETWORK: 'localhost'
              }
            });
          } else {
            outputChannel.appendLine("No deployment scripts found in scripts directory.");
            // We're returning early but still include account info
            return { 
              success: true, 
              message: 'Node started but no deploy scripts found. Contracts were not deployed.',
              nodeInfo: getNodeInfo()
            };
          }
        } else {
          outputChannel.appendLine("No scripts directory found for deployment.");
          // We're returning early but still include account info
          return { 
            success: true, 
            message: 'Node started but no deploy scripts found. Contracts were not deployed.',
            nodeInfo: getNodeInfo()
          };
        }
      }
      
      outputChannel.appendLine("Deployment completed successfully");
    } catch (error: any) {
      outputChannel.appendLine(`Deployment failed: ${error.message}`);
      // We're returning early but still include account info
      return { 
        success: true, 
        message: 'Node started but deployment failed. See output for details.',
        nodeInfo: getNodeInfo()
      };
    }

    // Step 3: Get deployment information
    const deploymentInfo = await getDeploymentInfo(workspacePath);
    
    // Convert deployment info to the contract array format
    const contracts = deploymentInfoToContractArray(deploymentInfo);
    
    if (contracts.length > 0) {
      contracts.forEach(contract => {
        outputChannel.appendLine(`Contract ${contract.name} deployed at address: ${contract.address}`);
      });
    } else {
      outputChannel.appendLine("No deployed contracts found in standard locations.");
    }

    // Return node info and contract details
    return {
      success: true,
      message: 'Hardhat node started and contracts deployed successfully',
      nodeInfo: getNodeInfo(),
      contracts: contracts
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Stops the running Hardhat node if it was started by this extension
 */
export function stopNode(): boolean {
  if (nodeProcess && !nodeProcess.killed) {
    nodeProcess.kill();
    nodeProcess = null;
    isNodeRunning = false;
    return true;
  }
  return false;
}

/**
 * Checks if a node is currently running
 */
export function isNodeActive(): boolean {
  return isNodeRunning && nodeProcess !== null && !nodeProcess.killed;
}

/**
 * Gets information about deployed contracts
 */
export async function getDeploymentInfo(workspacePath: string): Promise<{
  contractNames: string[];
  contractAddresses: {[name: string]: string};
  contractAbis: {[name: string]: any};
}> {
  const deploymentDir = path.join(workspacePath, 'deployments', 'localhost');
  const contractNames: string[] = [];
  const contractAddresses: {[name: string]: string} = {};
  const contractAbis: {[name: string]: any} = {};
  
  if (fs.existsSync(deploymentDir)) {
    const files = fs.readdirSync(deploymentDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const deploymentPath = path.join(deploymentDir, file);
        const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        const contractName = file.replace('.json', '');
        
        contractNames.push(contractName);
        contractAddresses[contractName] = deploymentData.address;
        contractAbis[contractName] = deploymentData.abi;
      } catch (err) {
        console.error(`Error reading deployment file ${file}:`, err);
      }
    }
  }

  // Also check artifacts directory for any deployed contracts if deployment directory doesn't exist
  if (contractNames.length === 0) {
    try {
      const artifactsDir = path.join(workspacePath, 'artifacts', 'contracts');
      if (fs.existsSync(artifactsDir)) {
        // Try to find deployed contracts by checking recent contracts.json or other indicators
        // This is a fallback when hardhat-deploy isn't used
        // For now, this is just a placeholder
      }
    } catch (err) {
      console.error('Error checking artifacts directory:', err);
    }
  }
  
  return {
    contractNames,
    contractAddresses,
    contractAbis
  };
}

/**
 * Converts deployment info to an array of contract info objects
 */
function deploymentInfoToContractArray(deploymentInfo: {
  contractNames: string[];
  contractAddresses: {[name: string]: string};
  contractAbis: {[name: string]: any};
}): ContractInfo[] {
  const contracts: ContractInfo[] = [];
  
  for (const name of deploymentInfo.contractNames) {
    if (deploymentInfo.contractAddresses[name] && deploymentInfo.contractAbis[name]) {
      contracts.push({
        name,
        address: deploymentInfo.contractAddresses[name],
        abi: deploymentInfo.contractAbis[name]
      });
    }
  }
  
  return contracts;
}

/**
 * Returns all available information for transaction creation
 */
export async function getTransactionInfo(): Promise<{
  nodeInfo: NodeInfo;
  contracts: ContractInfo[];
}> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    return { nodeInfo: getNodeInfo(), contracts: [] };
  }
  
  const deploymentInfo = await getDeploymentInfo(workspacePath);
  const contracts = deploymentInfoToContractArray(deploymentInfo);
  
  return {
    nodeInfo: getNodeInfo(),
    contracts: contracts
  };
}