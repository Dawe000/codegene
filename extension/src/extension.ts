import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SidebarWebViewProvider } from './webviewProvider';
import { getSolAndRustFileNames, getGroupedFileNames } from './fileNameUtils';
import { analyzeContract } from './veniceService';
import * as fileUtils from './fileUtils';
import * as hardhatService from './hardhatService';

// Create a dedicated output channel
let outputChannel: vscode.OutputChannel;

// Make provider accessible from both functions
let provider: SidebarWebViewProvider;

// Add this at the top of your file with other state variables
let lastAnalyzedCode: string = ''; // Store the last analyzed contract code

// Add this near the top of your file where you define variables
const TEMP_FILE_PATH = path.join(os.tmpdir(), 'lastAnalyzedCode.sol');

// Load environment variables from .env file
function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    console.log(`Looking for .env file at: ${envPath}`);
    
    if (fs.existsSync(envPath)) {
      console.log('.env file found, loading variables');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');
      
      envLines.forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*"?([^"]*)"?\s*$/);
        if (match) {
          const key = match[1];
          const value = match[2];
          process.env[key] = value;
          console.log(`Loaded env var: ${key} (${value.substring(0, 3)}...)`);
        }
      });
    } else {
      console.log('No .env file found');
    }
  } catch (error) {
    console.error('Error loading .env file:', error);
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Sidebar extension activating...');
  
  // Load environment variables first
  loadEnvFile();
  
  // Initialize output channel
  outputChannel = vscode.window.createOutputChannel('Solidity & Rust Files');
  context.subscriptions.push(outputChannel);
  
  // Create WebView provider and store the reference
  provider = new SidebarWebViewProvider(context.extensionUri);
  
  // Register the WebView
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("mySidebar", provider)
  );
  
  // Register commands
  context.subscriptions.push(
    // Save text command
    vscode.commands.registerCommand('testsidebarextension.saveText', () => {
      vscode.window.showInformationMessage('This is a placeholder for the save text command.');
    }),
    
    // Clear history command
    vscode.commands.registerCommand('testsidebarextension.clearHistory', () => {
      vscode.window.showInformationMessage('History cleared');
    }),
    
    // Analyze contract command
    vscode.commands.registerCommand('testsidebarextension.analyzeContract', () => {
      analyzeCurrentFile(provider);
    }),
    
    // Analyze contract from explorer context menu
    vscode.commands.registerCommand('testsidebarextension.analyzeContractFromExplorer', (fileUri: vscode.Uri) => {
      analyzeFileByUri(fileUri);
    }),
    
    // Analyze all contracts in a Hardhat project
    vscode.commands.registerCommand('testsidebarextension.analyzeAllContracts', () => {
      analyzeHardhatContracts(provider);
    }),
    
    // Hardhat node commands (kept intact)
    vscode.commands.registerCommand('testsidebarextension.startNodeAndDeploy', async () => {
      try {
        const result = await hardhatService.startNodeAndDeploy(outputChannel);
        
        if (result.success) {
          vscode.window.showInformationMessage(result.message);
          
          // If webview is available, send the deployment info
          if (provider && provider.webview) {
            provider.webview.postMessage({
              command: 'hardhatNodeStarted',
              nodeUrl: result.nodeInfo?.url || 'http://localhost:8545',
              contractAddresses: result.contracts 
                ? result.contracts.map(contract => ({
                    name: contract.name,
                    address: contract.address
                  })) 
                : []
            });
          }
        } else {
          vscode.window.showErrorMessage(result.message);
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
      }
    }),
    
    vscode.commands.registerCommand('testsidebarextension.stopNode', () => {
      const stopped = hardhatService.stopNode();
      if (stopped) {
        vscode.window.showInformationMessage('Hardhat node stopped');
        
        // Notify webview if available
        if (provider && provider.webview) {
          provider.webview.postMessage({
            command: 'hardhatNodeStopped'
          });
        }
      } else {
        vscode.window.showInformationMessage('No Hardhat node is running');
      }
    }),

    // Add new transaction commands
    vscode.commands.registerCommand('testsidebarextension.getContractInfo', async () => {
      try {
        const transactionInfo = await hardhatService.getTransactionInfo();
        if (transactionInfo.contracts.length > 0) {
          const contractList = transactionInfo.contracts.map(c => `${c.name}: ${c.address}`).join('\n');
          vscode.window.showInformationMessage(`Deployed contracts:\n${contractList}`);
          
          // Also log to output
          outputChannel.appendLine('--- Deployed Contracts ---');
          transactionInfo.contracts.forEach(c => {
            outputChannel.appendLine(`${c.name}: ${c.address}`);
          });
        } else {
          vscode.window.showInformationMessage('No deployed contracts found');
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
      }
    }),
    
    vscode.commands.registerCommand('testsidebarextension.getAccountInfo', () => {
      try {
        const nodeInfo = hardhatService.getNodeInfo();
        if (nodeInfo.isRunning) {
          const accountInfo = nodeInfo.accounts.map(a => 
            `Address: ${a.address}\nPrivate Key: ${a.privateKey}`
          ).join('\n\n');
          
          // Show a subset in the notification
          const shortInfo = nodeInfo.accounts.slice(0, 2).map(a => 
            `${a.address.substring(0, 10)}...`
          ).join(', ') + ', ...';
          
          vscode.window.showInformationMessage(`Available accounts: ${shortInfo} (see output channel for details)`);
          
          // Log full details to output
          outputChannel.appendLine('--- Hardhat Accounts ---');
          nodeInfo.accounts.forEach((a, i) => {
            outputChannel.appendLine(`Account ${i}:`);
            outputChannel.appendLine(`  Address: ${a.address}`);
            outputChannel.appendLine(`  Private Key: ${a.privateKey}`);
            outputChannel.appendLine('');
          });
        } else {
          vscode.window.showWarningMessage('Hardhat node is not running');
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
      }
    })
  );
  
  // Show files when extension is activated
  showFiles(provider);
}

// Keep only these analysis functions
async function showFiles(provider?: SidebarWebViewProvider) {
  try {
    outputChannel.appendLine('===== CHECKING FOR HARDHAT PROJECT =====');
    
    // Use fileUtils for Hardhat project detection
    const isHardhat = await fileUtils.isHardhatProject();
    if (isHardhat) {
      outputChannel.appendLine('Hardhat project detected');
      
      // Use fileUtils to get Hardhat contracts
      const contracts = await fileUtils.findHardhatContracts();
      outputChannel.appendLine(`Found ${contracts.length} contracts in the Hardhat project`);
      
      // Send to webview if provider exists
      if (provider && provider.webview) {
        provider.webview.postMessage({
          command: 'displayFiles',
          isHardhatProject: true,
          projectPath: fileUtils.getWorkspacePath() || '',
          files: contracts
        });
      }
    } else {
      outputChannel.appendLine('No Hardhat project detected');
      
      // Fallback to regular file detection (still show Solidity/Rust files)
      getSolAndRustFileNames()
        .then(files => {
          // Show in output channel
          outputChannel.appendLine(`\nFound ${files.length} files:`);
          files.forEach(file => outputChannel.appendLine(`- ${file}`));
          
          // Send to webview
          if (provider && provider.webview) {
            provider.webview.postMessage({
              command: 'displayFiles',
              isHardhatProject: false,
              files: files.map(name => ({
                name: name,
                path: '' // We don't have paths for these right now
              }))
            });
          }
        });
    }
  } catch (error) {
    console.error('Error in showFiles:', error);
    vscode.window.showErrorMessage('Error detecting project files. See console for details.');
  }
}

async function analyzeCurrentFile(provider?: SidebarWebViewProvider) {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No file is currently open');
      return;
    }
    
    const document = editor.document;
    const fileName = document.fileName;
    
    // Check if the file is a Solidity or Rust file
    if (!fileName.endsWith('.sol') && !fileName.endsWith('.rs')) {
      vscode.window.showWarningMessage('Only Solidity (.sol) and Rust (.rs) files can be analyzed');
      return;
    }
    
    // Get the file content
    const fileContent = document.getText();
    
    vscode.window.showInformationMessage(`Analyzing ${fileName}...`);
    console.log(`Analyzing contract in ${fileName}`);
    
    // Analyze the contract
    const result = await analyzeContract(fileContent);
    
    // Log the results to the console
    console.log('Analysis result:', result);
    
    // Send results to webview if available
    if (provider && provider.webview) {
      provider.webview.postMessage({
        command: 'displayAnalysis',
        analysis: result,
        fileName: path.basename(fileName)
      });
    }
    
    // Show a notification with the overall score
    if (result && typeof result.overall_score === 'number') {
      vscode.window.showInformationMessage(
        `Analysis complete: Overall score: ${result.overall_score}/100`
      );
    } else {
      vscode.window.showInformationMessage('Analysis complete. See sidebar for details.');
    }
  } catch (error: any) {
    console.error('Error analyzing contract:', error);
    vscode.window.showErrorMessage(`Error analyzing contract: ${error.message}`);
    
    // Send error to webview if available
    if (provider && provider.webview) {
      provider.webview.postMessage({
        command: 'displayAnalysis',
        analysis: { error: error.message },
        fileName: vscode.window.activeTextEditor?.document ? path.basename(vscode.window.activeTextEditor.document.fileName) : 'Unknown'
      });
    }
  }
}

async function analyzeFileByUri(fileUri: vscode.Uri) {
  try {
    // Read the file content
    const document = await vscode.workspace.openTextDocument(fileUri);
    const fileName = fileUri.fsPath;
    
    // Check if the file is a Solidity or Rust file
    if (!fileName.endsWith('.sol') && !fileName.endsWith('.rs')) {
      vscode.window.showWarningMessage('Only Solidity (.sol) and Rust (.rs) files can be analyzed');
      return;
    }
    
    // Get the file content
    const fileContent = document.getText();
    
    vscode.window.showInformationMessage(`Analyzing ${fileName}...`);
    console.log(`Analyzing contract in ${fileName}`);
    
    // Analyze the contract
    const result = await analyzeContract(fileContent);
    
    // Log the results to the console
    console.log('Analysis result:', result);
    
    // Add webview logic
    if (provider && provider.webview) {
      provider.webview.postMessage({
        command: 'displayAnalysis',
        analysis: result,
        fileName: path.basename(fileName)
      });
    }
    
    // Show a notification with the overall score
    if (result && typeof result.overall_score === 'number') {
      vscode.window.showInformationMessage(
        `Analysis complete: Overall score: ${result.overall_score}/100`
      );
    } else {
      vscode.window.showInformationMessage('Analysis complete. See console for details.');
    }
  } catch (error: any) {
    console.error('Error analyzing contract:', error);
    vscode.window.showErrorMessage(`Error analyzing contract: ${error.message}`);
  }
}


async function analyzeHardhatContracts(provider?: SidebarWebViewProvider) {
  try {
    setIsLoading(true);
    
    // Get all contracts using fileUtils
    const contracts = await fileUtils.findHardhatContracts();
    
    if (contracts.length === 0) {
      vscode.window.showWarningMessage('No contracts found in Hardhat project');
      setIsLoading(false);
      return;
    }
    
    // Use fileUtils to read and combine contracts
    const contractPaths = contracts.map(c => c.path);
    const combinedCode = await fileUtils.readAndCombineContracts(contractPaths);
    
    // Store the contract code globally for later use with test generation
    // This is the key fix - make sure we're setting the global variable
    lastAnalyzedCode = combinedCode;
    console.log(`[analyzeHardhatContracts] Stored ${combinedCode.length} characters in lastAnalyzedCode`);
    
    // Also save to a temp file as a redundant backup
    try {
      fs.writeFileSync(TEMP_FILE_PATH, combinedCode);
      console.log(`[analyzeHardhatContracts] Saved ${combinedCode.length} characters to temp file: ${TEMP_FILE_PATH}`);
    } catch (error) {
      console.error('Error writing to temp file:', error);
    }
    
    vscode.window.showInformationMessage(`Analyzing ${contracts.length} contracts...`);
    
    // Analyze the combined contracts
    const result = await analyzeContract(combinedCode);
    
    // Send results to webview
    if (provider && provider.webview) {
      provider.webview.postMessage({
        command: 'displayAnalysis',
        analysis: result,
        fileName: contracts.map(c => c.name).join(', ')
      });
    }
    
    // Show a notification with the overall score
    if (result && typeof result.overall_score === 'number') {
      vscode.window.showInformationMessage(
        `Analysis complete: Overall score: ${result.overall_score}/100`
      );
    } else {
      vscode.window.showInformationMessage('Analysis complete. See sidebar for details.');
    }
  } catch (error: any) {
    console.error('Error analyzing Hardhat contracts:', error);
    vscode.window.showErrorMessage(`Error analyzing contracts: ${error.message}`);
    
    // Send error to webview
    if (provider && provider.webview) {
      provider.webview.postMessage({
        command: 'displayAnalysis',
        analysis: { error: error.message },
        fileName: 'Hardhat Contracts'
      });
    }
  } finally {
    setIsLoading(false);
  }
}

// Helper function to set loading state
function setIsLoading(loading: boolean) {
  if (provider && provider.webview) {
    provider.webview.postMessage({
      command: loading ? 'startLoading' : 'stopLoading'
    });
  }
}

// Create webview content
function createWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Contract Analysis</title>
    <link rel="stylesheet" href="${webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'tailwind.css'))}">
</head>
<body>
    <div id="root"></div>
    <script src="${webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'webview.js'))}"></script>
</body>
</html>`;
}

export function deactivate() {}
