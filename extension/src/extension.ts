import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import { SidebarWebViewProvider } from './webviewProvider';
import { getSolAndRustFileNames, getGroupedFileNames } from './fileNameUtils';
import { analyzeContract, generatePenetrationTest, generateMultiplePenetrationTests } from './veniceService';
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
    }),

    // Generate penetration test command
    vscode.commands.registerCommand('testsidebarextension.generatePenetrationTest', async () => {
      try {
        // Get the active editor
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
        const contractName = path.basename(fileName, path.extname(fileName));
        
        // Show quick pick for vulnerability types
        const vulnerabilityTypes = [
          'Reentrancy', 
          'Integer Overflow/Underflow', 
          'Access Control', 
          'Unchecked Return Values', 
          'Front-Running',
          'Timestamp Dependence',
          'All Vulnerabilities'
        ];
        
        const selectedVulnerability = await vscode.window.showQuickPick(vulnerabilityTypes, {
          placeHolder: 'Select vulnerability type to target (or cancel for general testing)'
        });
        
        // Show progress notification
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Generating Smart Contract Penetration Test",
          cancellable: false
        }, async (progress) => {
          progress.report({ increment: 0 });
          
          // Generate the penetration test
          const result = await generatePenetrationTest(
            fileContent, 
            contractName, 
            selectedVulnerability !== 'All Vulnerabilities' ? selectedVulnerability : undefined
          );
          
          progress.report({ increment: 100 });
          
          if (result.success && result.filePath) {
            const openFile = 'Open Test File';
            const response = await vscode.window.showInformationMessage(
              `Penetration test generated successfully at ${result.filePath}`, 
              openFile
            );
            
            if (response === openFile) {
              const fileUri = vscode.Uri.file(result.filePath);
              await vscode.window.showTextDocument(fileUri);
            }
          } else {
            vscode.window.showErrorMessage(`Failed to generate penetration test: ${result.error}`);
          }
        });
        
      } catch (error: any) {
        console.error('Error generating penetration test:', error);
        vscode.window.showErrorMessage(`Error: ${error.message}`);
      }
    }),

    // Generate and run penetration test command
    vscode.commands.registerCommand('testsidebarextension.generateAndRunPenetrationTest', async () => {
      try {
        // Check if we have analyzed code available
        if (!lastAnalyzedCode || lastAnalyzedCode.length === 0) {
          // Try to load from temp file if available
          try {
            if (fs.existsSync(TEMP_FILE_PATH)) {
              lastAnalyzedCode = fs.readFileSync(TEMP_FILE_PATH, 'utf8');
              console.log(`[generateAndRunPenetrationTest] Loaded ${lastAnalyzedCode.length} characters from temp file`);
            }
          } catch (err) {
            console.error('Error loading from temp file:', err);
          }
          
          if (!lastAnalyzedCode || lastAnalyzedCode.length === 0) {
            vscode.window.showErrorMessage('No contract code available. Please analyze contracts first.');
            return;
          }
        }
        
        // Log the contract code for debugging
        console.log('========= CONTRACT CODE FOR PENETRATION TEST =========');
        console.log(lastAnalyzedCode);
        console.log('=====================================================');
        
        // Show progress notification
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Generating & Running Penetration Test",
          cancellable: false
        }, async (progress) => {
          // Update UI
          if (provider && provider.webview) {
            provider.webview.postMessage({
              command: 'startLoading'
            });
          }
          
          progress.report({ increment: 20, message: "Generating test..." });
          
          // Generate the penetration test
          const contractName = 'HardhatContracts'; // Generic name for combined contracts
          const result = await generatePenetrationTest(lastAnalyzedCode, contractName);
          
          if (!result.success || !result.filePath) {
            throw new Error(result.error || 'Failed to generate penetration test');
          }
          
          // Detailed logging for debug
          outputChannel.appendLine('\n======== GENERATED PENETRATION TEST DETAILS ========');
          outputChannel.appendLine(`Test file path: ${result.filePath}`);
          outputChannel.appendLine('\nTest File Content:');
          try {
            const testContent = fs.readFileSync(result.filePath, 'utf8');
            outputChannel.appendLine(testContent);
          } catch (err) {
            if (err instanceof Error) {
                outputChannel.appendLine(`Error reading test file: ${err.message}`);
            } else {
                outputChannel.appendLine('Error reading test file: Unknown error');
            }
          }
          outputChannel.appendLine('===================================================\n');
          
          // Log the generated test for debugging
          try {
            const testCode = fs.readFileSync(result.filePath, 'utf8');
            console.log('========= GENERATED PENETRATION TEST CODE =========');
            console.log(testCode);
            console.log('==================================================');
          } catch (err) {
            console.error('Error reading generated test file:', err);
          }
          
          progress.report({ increment: 30, message: "Preparing test environment..." });
          
          // Ensure test dependencies
          const depsReady = await ensureTestDependencies();
          if (!depsReady) {
            throw new Error("Failed to prepare test environment. See output channel for details.");
          }
          
          progress.report({ increment: 40, message: "Running test..." });
          
          // Run the test
          const testResult = await runPenetrationTest(result.filePath);
          
          // Hide loading indicator
          if (provider && provider.webview) {
            provider.webview.postMessage({
              command: 'stopLoading'
            });
          }
          
          progress.report({ increment: 40, message: "Complete" });
          
          // Show test results in webview
          if (provider && provider.webview) {
            provider.webview.postMessage({
              command: 'displayPenetrationTestResult',
              success: testResult.success,
              exploitSuccess: testResult.exploitSuccess,
              securityImplication: testResult.securityImplication,
              output: testResult.output,
              filePath: result.filePath
            });
          }

          // Show a notification with the result
          if (testResult.exploitSuccess) {
            vscode.window.showWarningMessage(
              `⚠️ Vulnerability successfully exploited! See details in the sidebar.`
            );
          } else if (testResult.success) {
            vscode.window.showInformationMessage(
              `✅ Contract protected against this vulnerability. See details in the sidebar.`
            );
          } else {
            vscode.window.showWarningMessage(
              `Test execution had technical issues. See results in the sidebar.`
            );
          }
        });
      } catch (error: any) {
        console.error('Error generating and running penetration test:', error);
        vscode.window.showErrorMessage(`Error: ${error.message}`);
        
        // Reset loading state in case of error
        if (provider && provider.webview) {
          provider.webview.postMessage({
            command: 'stopLoading'
          });
        }
      }
    }),

    // Generate and run multiple penetration tests command
    vscode.commands.registerCommand('testsidebarextension.generateAndRunMultipleTests', async (params) => {
      try {
        // Check if we have analyzed code available
        if (!lastAnalyzedCode || lastAnalyzedCode.length === 0) {
          // Try to load from temp file if available (existing code for fallback)
          try {
            if (fs.existsSync(TEMP_FILE_PATH)) {
              lastAnalyzedCode = fs.readFileSync(TEMP_FILE_PATH, 'utf8');
              console.log(`Loaded ${lastAnalyzedCode.length} characters from temp file`);
            }
          } catch (err) {
            console.error('Error loading from temp file:', err);
          }
          
          if (!lastAnalyzedCode || lastAnalyzedCode.length === 0) {
            vscode.window.showErrorMessage('No contract code available. Please analyze contracts first.');
            return;
          }
        }
        
        // Get vulnerabilities from parameters or latest analysis
        const vulnerabilities = params?.vulnerabilities || [];
        
        if (!vulnerabilities || vulnerabilities.length === 0) {
          vscode.window.showWarningMessage('No vulnerabilities detected to test. Please analyze the contract first.');
          return;
        }
        
        // Show progress notification
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Generating ${vulnerabilities.length} Penetration Tests`,
          cancellable: false
        }, async (progress) => {
          // Update UI
          if (provider && provider.webview) {
            provider.webview.postMessage({
              command: 'startLoading'
            });
          }
          
          outputChannel.appendLine(`\n======== GENERATING ${vulnerabilities.length} PENETRATION TESTS ========`);
          outputChannel.appendLine(`Found ${vulnerabilities.length} vulnerabilities to test`);
          vulnerabilities.forEach((v: any) => {
            outputChannel.appendLine(`- ${v.name} (${v.severity}): ${v.description.substring(0, 100)}...`);
          });
          outputChannel.show();
          
          progress.report({ increment: 10, message: `Generating ${vulnerabilities.length} tests...` });
          
          // Generate all tests
          const contractName = 'HardhatContracts'; // Generic name for combined contracts
          const result = await generateMultiplePenetrationTests(
            lastAnalyzedCode, 
            contractName, 
            vulnerabilities
          );
          
          if (!result.success || result.tests.length === 0) {
            throw new Error(result.error || 'Failed to generate penetration tests');
          }
          
          outputChannel.appendLine(`Generated ${result.tests.length} test files`);
          
          // Ensure dependencies are installed
          progress.report({ increment: 20, message: "Preparing test environment..." });
          const depsReady = await ensureTestDependencies();
          if (!depsReady) {
            throw new Error("Failed to prepare test environment. See output channel for details.");
          }
          
          // Run each test
          progress.report({ increment: 20, message: `Running ${result.tests.length} tests...` });
          
          const testResults = [];
          
          for (let i = 0; i < result.tests.length; i++) {
            const test = result.tests[i];
            outputChannel.appendLine(`\nRunning test ${i+1}/${result.tests.length} for ${test.vulnerability}...`);
            progress.report({ 
              increment: Math.floor(50 / result.tests.length), 
              message: `Test ${i+1}/${result.tests.length}: ${test.vulnerability}` 
            });
            
            // Run the test
            const testResult = await runPenetrationTest(test.filePath);

            // Use type assertion to avoid TypeScript error
            const extendedTest = test as {
              vulnerability: string;
              filePath: string;
              success?: boolean;
              exploitSuccess?: boolean;
              output?: string;
              securityImplication?: string;
            };

            // Now assign the properties
            extendedTest.success = testResult.success;
            extendedTest.exploitSuccess = testResult.exploitSuccess || false;
            extendedTest.output = testResult.output;
            extendedTest.securityImplication = testResult.securityImplication || '';
            testResults.push(extendedTest);
          }
          
          // Hide loading indicator
          if (provider && provider.webview) {
            provider.webview.postMessage({
              command: 'stopLoading'
            });
          }
          
          progress.report({ increment: 100, message: "Complete" });
          
          // Show consolidated results in webview
          if (provider && provider.webview) {
            provider.webview.postMessage({
              command: 'displayMultiplePenetrationTestResults',
              testResults
            });
          }
          
          // Show a notification with the overall result
          const successfulTests = testResults.filter(t => t.exploitSuccess === true).length;
          vscode.window.showInformationMessage(
            `Penetration testing complete: ${successfulTests} vulnerabilities exploitable, ` +
            `${testResults.length - successfulTests} protections verified. See results in the sidebar.`
          );
        });
      } catch (error: any) {
        console.error('Error generating and running penetration tests:', error);
        vscode.window.showErrorMessage(`Error: ${error.message}`);
        
        // Reset loading state in case of error
        if (provider && provider.webview) {
          provider.webview.postMessage({
            command: 'stopLoading'
          });
        }
      }
    }),
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

/**
 * Runs a generated penetration test and returns the result
 * @param testFilePath Path to the TypeScript penetration test file
 * @returns Promise with the test result and output
 */
async function runPenetrationTest(testFilePath: string): Promise<{ success: boolean; exploitSuccess?: boolean; output: string; securityImplication?: string }> {
  return new Promise((resolve) => {
    outputChannel.appendLine('\n======== RUNNING PENETRATION TEST ========');
    outputChannel.appendLine(`Test file: ${testFilePath}`);
    outputChannel.show();
    
    const workspacePath = fileUtils.getWorkspacePath();
    if (!workspacePath) {
      outputChannel.appendLine('Error: No workspace folder is open');
      return resolve({ success: false, output: 'No workspace folder is open' });
    }
    
    try {
      // First, extract vulnerability description from the test file
      let vulnerabilityDescription = '';
      let testPurpose = '';
      
      try {
        const testContent = fs.readFileSync(testFilePath, 'utf8');
        // Extract description from test file comments
        const descriptionMatch = testContent.match(/\/\*\*\s*\n\s*\*\s*Penetration Test:[^*]*\*\s*Target Contract:[^*]*\*\s*\n\s*\*\s*Description:\s*([^*]*)/);
        if (descriptionMatch && descriptionMatch[1]) {
          vulnerabilityDescription = descriptionMatch[1].trim();
        }
        
        // Get the test name to understand what we're testing
        const testNameMatch = testContent.match(/describe\("([^"]*)/);
        if (testNameMatch && testNameMatch[1]) {
          testPurpose = testNameMatch[1].trim();
        }
      } catch (err) {
        console.error('Error reading test file for description:', err);
      }
      
      // Run the test directly with Hardhat instead of trying to compile it separately
      outputChannel.appendLine('Running test with Hardhat...');
      
      const testProcess = spawn('npx', ['hardhat', 'test', testFilePath], {
        cwd: workspacePath,
        shell: true,
        env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' } // Speed up TypeScript transpilation
      });
      
      let testOutput = '';
      
      testProcess.stdout.on('data', (data) => {
        const output = data.toString();
        testOutput += output;
        outputChannel.appendLine(output);
      });
      
      testProcess.stderr.on('data', (data) => {
        const output = data.toString();
        testOutput += output;
        outputChannel.appendLine(`Error: ${output}`);
      });
      
      testProcess.on('close', (code) => {
        outputChannel.appendLine(`\nPenetration test finished with code ${code}`);
        
        const testRanSuccessfully = code === 0;
        let exploitSuccess = testRanSuccessfully;
        let securityImplication = '';
        
        // If test fails, it could mean the vulnerability isn't exploitable (good for security)
        if (!testRanSuccessfully) {
          // Look for assertion errors that indicate failed exploitation
          if (testOutput.includes('AssertionError') || testOutput.includes('expected') && testOutput.includes('to be')) {
            securityImplication = 'The contract appears to be protected against this vulnerability. ' +
              'The test ran but the exploit was not successful, which is a positive security outcome.';
            exploitSuccess = false;
          } else {
            securityImplication = 'The test failed to run properly. This could be due to technical issues ' +
              'rather than security protections.';
          }
        } else {
          // Test passed, which means vulnerability was successfully exploited
          securityImplication = 'The vulnerability was successfully exploited. ' +
            'This is a security concern that should be addressed.';
        }
        
        outputChannel.appendLine(exploitSuccess 
          ? '⚠️ Vulnerability EXPLOITED! (security issue found)'
          : '✅ Exploit FAILED! (contract is protected)');
        outputChannel.appendLine('========================================');
        
        // Sometimes the test might fail but we still want to show the output
        // If no output, include the test file for reference
        if (!testOutput) {
          try {
            const testCode = fs.readFileSync(testFilePath, 'utf8');
            testOutput = `No output from test execution.\n\nTest code:\n${testCode}`;
          } catch (err) {
            // Ignore file read errors
          }
        }
        
        resolve({
          success: true, // The test ran (even if exploit failed)
          exploitSuccess: exploitSuccess,
          output: testOutput,
          securityImplication
        });
      });
    } catch (error: any) {
      outputChannel.appendLine(`Error executing test: ${error.message}`);
      
      // Include the test file content in the output
      try {
        const testCode = fs.readFileSync(testFilePath, 'utf8');
        resolve({
          success: false,
          output: `Error executing test: ${error.message}\n\n${testCode}`
        });
      } catch (readErr) {
        resolve({
          success: false,
          output: `Error executing test: ${error.message}`
        });
      }
    }
  });
}

/**
 * Ensures the workspace has all dependencies needed for testing
 */
async function ensureTestDependencies(): Promise<boolean> {
  const workspacePath = fileUtils.getWorkspacePath();
  if (!workspacePath) {
    outputChannel.appendLine('Error: No workspace folder is open');
    return false;
  }
  
  try {
    // Check if package.json exists
    const packageJsonPath = path.join(workspacePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      outputChannel.appendLine('Error: package.json not found in workspace');
      return false;
    }
    
    // Check if required dependencies are installed
    const requiredDeps = ['chai', '@types/chai', '@nomicfoundation/hardhat-ethers'];
    const missingDeps = [];
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const allDeps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {})
    };
    
    for (const dep of requiredDeps) {
      if (!allDeps[dep]) {
        missingDeps.push(dep);
      }
    }
    
    if (missingDeps.length > 0) {
      outputChannel.appendLine(`Installing missing dependencies: ${missingDeps.join(', ')}`);
      
      // Install missing dependencies
      const installProcess = spawn('npm', ['install', '--save-dev', ...missingDeps], {
        cwd: workspacePath,
        shell: true
      });
      
      return new Promise((resolve) => {
        installProcess.stdout.on('data', (data) => {
          outputChannel.appendLine(data.toString());
        });
        
        installProcess.stderr.on('data', (data) => {
          outputChannel.appendLine(`Error: ${data.toString()}`);
        });
        
        installProcess.on('close', (code) => {
          const success = code === 0;
          if (success) {
            outputChannel.appendLine('Dependencies installed successfully');
          } else {
            outputChannel.appendLine('Failed to install dependencies');
          }
          resolve(success);
        });
      });
    }
    
    return true;
  } catch (error: any) {
    outputChannel.appendLine(`Error ensuring test dependencies: ${error.message}`);
    return false;
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
