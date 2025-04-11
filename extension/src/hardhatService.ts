import * as vscode from 'vscode';
import { spawn, ChildProcess, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { getWorkspacePath } from './fileUtils';

// Store node process for management
let nodeProcess: ChildProcess | null = null;
let isNodeRunning: boolean = false;

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
 * Starts a Hardhat node and deploys contracts
 * @param outputChannel VSCode output channel for logging
 * @returns Promise<{success: boolean, message: string, contractAddress?: string}>
 */
export async function startNodeAndDeploy(outputChannel: vscode.OutputChannel): Promise<{
  success: boolean;
  message: string;
  contractAddresses?: string[];
  nodeUrl?: string;
}> {
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
    } else if (portInUse && isNodeRunning) {
      outputChannel.appendLine("A node started by this extension is already running.");
      return { 
        success: true, 
        message: 'Node is already running', 
        nodeUrl: 'http://localhost:8545' 
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
            return { 
              success: true, 
              message: 'Node started but no deploy scripts found. Contracts were not deployed.',
              nodeUrl: 'http://localhost:8545'
            };
          }
        } else {
          outputChannel.appendLine("No scripts directory found for deployment.");
          return { 
            success: true, 
            message: 'Node started but no deploy scripts found. Contracts were not deployed.',
            nodeUrl: 'http://localhost:8545'
          };
        }
      }
      
      outputChannel.appendLine("Deployment completed successfully");
    } catch (error: any) {
      outputChannel.appendLine(`Deployment failed: ${error.message}`);
      // Node is running but deployment failed
      return { 
        success: true, 
        message: 'Node started but deployment failed. See output for details.',
        nodeUrl: 'http://localhost:8545'
      };
    }

    // Step 3: Check for the deployment file if using hardhat-deploy
    const deploymentDir = path.join(workspacePath, 'deployments', 'localhost');
    const contractAddresses: string[] = [];
    
    if (fs.existsSync(deploymentDir)) {
      outputChannel.appendLine(`Looking for deployment artifacts in: ${deploymentDir}`);
      
      const files = fs.readdirSync(deploymentDir).filter(f => f.endsWith('.json'));
      outputChannel.appendLine(`Found deployment files: ${files.join(', ')}`);
      
      for (const file of files) {
        try {
          const deploymentPath = path.join(deploymentDir, file);
          const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
          const contractName = file.replace('.json', '');
          const contractAddress = deploymentData.address;
          
          outputChannel.appendLine(`Contract ${contractName} deployed at address: ${contractAddress}`);
          contractAddresses.push(`${contractName}: ${contractAddress}`);
        } catch (err) {
          outputChannel.appendLine(`Error reading deployment file ${file}: ${err}`);
        }
      }
    } else {
      outputChannel.appendLine("No deployment artifacts directory found. This is normal if not using hardhat-deploy.");
    }

    return {
      success: true,
      message: 'Hardhat node started and contracts deployed successfully',
      contractAddresses: contractAddresses,
      nodeUrl: 'http://localhost:8545'
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