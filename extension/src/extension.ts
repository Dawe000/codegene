import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import { SidebarWebViewProvider } from './webviewProvider';
import { getSolAndRustFileNames, getGroupedFileNames } from './fileNameUtils';
import { 
  analyzeTestFailure, 
  analyzeContract, 
  generatePenetrationTest, 
  generateMultiplePenetrationTests, 
  adaptPenetrationTest, 
  generateSecurityReport, 
  runAndRefineTestUntilSuccess, 
  runMultipleTestsInParallel,
  extractVulnerabilityFromFilename
} from './veniceService';
import * as fileUtils from './fileUtils';
import * as hardhatService from './hardhatService';
import { ChatCompletionRequestWithVenice } from './types';

// Create a dedicated output channel
let outputChannel: vscode.OutputChannel;

// Make provider accessible from both functions
let provider: SidebarWebViewProvider;

// Add this at the top of your file with other state variables
let lastAnalyzedCode: string = ''; // Store the last analyzed contract code

// Add this near the top of your file where you define variables
const TEMP_FILE_PATH = path.join(os.tmpdir(), 'lastAnalyzedCode.sol');

// Add this near the top of your file where you define variables
let multipleTestResults: any[] = []; // Store multiple test results

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
    
    // Hardhat node commands (updated)
    vscode.commands.registerCommand('testsidebarextension.startNodeAndDeploy', async () => {
      try {
        // Basic check if hardhatService is properly set up
        if (typeof hardhatService.getSigner === 'function') {
          const result = await hardhatService.startNodeAndDeploy(outputChannel);
          vscode.window.showInformationMessage(result.message || 'Node started');
        } else {
          vscode.window.showInformationMessage('Hardhat service not fully configured');
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${(error as any).message}`);
      }
    }),
    
    vscode.commands.registerCommand('testsidebarextension.stopNode', () => {
      try {
        if (typeof hardhatService.stopNode === 'function') {
          const stopped = hardhatService.stopNode();
          vscode.window.showInformationMessage(stopped ? 
            'Hardhat node stopped' : 'No Hardhat node is running');
        } else {
          vscode.window.showInformationMessage('Hardhat service not fully configured');
        }
      } catch (error) {
        vscode.window.showErrorMessage('Error stopping Hardhat node');
      }
    }),

    // Add new transaction commands
    vscode.commands.registerCommand('testsidebarextension.getContractInfo', async () => {
      vscode.window.showInformationMessage('This functionality is currently disabled');
    }),
    
    vscode.commands.registerCommand('testsidebarextension.getAccountInfo', () => {
      vscode.window.showInformationMessage('This functionality is currently disabled');
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
              filePath: result.filePath,
              failureAnalysis: testResult.failureAnalysis // Add this line
            });
          }

          // Update single test result in provider
          if (provider) {
            provider.updateSingleTestResult({
              success: testResult.success,
              exploitSuccess: testResult.exploitSuccess,
              securityImplication: testResult.securityImplication,
              output: testResult.output,
              filePath: result.filePath,
              failureAnalysis: testResult.failureAnalysis
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
              failureAnalysis?: {
                isSecure: boolean;
                failureType: string;
                explanation: string;
                suggestedFix?: string;
              };
            };
            
            // Update the test result with the new data
            extendedTest.success = testResult.success;
            extendedTest.exploitSuccess = testResult.exploitSuccess;
            extendedTest.output = testResult.output;
            extendedTest.securityImplication = testResult.securityImplication;
            extendedTest.failureAnalysis = testResult.failureAnalysis;
            
            testResults.push(extendedTest);
          }
          
          // Store test results globally for later use
          multipleTestResults = testResults;

          // Update multiple test results in provider
          if (provider) {
            provider.updateTestResults(multipleTestResults);
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

    // Adapt and run penetration test command
    vscode.commands.registerCommand('testsidebarextension.adaptAndRunPenetrationTest', async (params) => {
      try {
        console.log("⭐ adaptAndRunPenetrationTest called with params:", params);
        
        // Update UI to show loading state
        if (provider && provider.webview) {
          provider.webview.postMessage({
            command: 'startLoading'
          });
        }
        
        // Show progress notification
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Adapting penetration test...",
          cancellable: false
        }, async (progress) => {
          // Get contract code (from temp file or active editor)
          let contractCode = '';
          try {
            if (fs.existsSync(TEMP_FILE_PATH)) {
              contractCode = fs.readFileSync(TEMP_FILE_PATH, 'utf8');
              console.log(`Loaded ${contractCode.length} characters from temp file`);
            } else {
              const editor = vscode.window.activeTextEditor;
              if (editor) {
                contractCode = editor.document.getText();
                console.log(`Loaded ${contractCode.length} characters from active editor`);
              }
            }
          } catch (error) {
            console.error('Error reading contract code:', error);
          }

          if (!contractCode) {
            throw new Error('No contract code available');
          }

          // Get the current attempt number
          const attemptNumber = params.attemptNumber || 1;
          console.log(`Adapting test, attempt number: ${attemptNumber}`);
          
          // Run original test to get fresh output
          progress.report({ increment: 20, message: "Running original test..." });
          console.log(`Running original test at path: ${params.testFilePath}`);
          const originalTestResult = await runPenetrationTest(params.testFilePath);
          console.log(`Original test result:`, originalTestResult);
          
          // Generate adapted test
          progress.report({ increment: 40, message: "Generating improved test..." });
          console.log(`Calling adaptPenetrationTest with exploit success: ${params.exploitSuccess}`);
          const adaptResult = await adaptPenetrationTest(
            contractCode,
            params.testFilePath,
            originalTestResult.output || '',
            params.exploitSuccess,
            attemptNumber
          );
          
          console.log(`Adapt result:`, adaptResult);
          if (!adaptResult.success || !adaptResult.filePath) {
            throw new Error(adaptResult.error || 'Failed to adapt test');
          }
          
          // Run the adapted test
          progress.report({ increment: 70, message: "Running improved test..." });
          console.log(`Running adapted test at path: ${adaptResult.filePath}`);
          const newTestResult = await runPenetrationTest(adaptResult.filePath);
          console.log(`New test result:`, newTestResult);
          
          // Send results to webview to display new card
          if (provider && provider.webview) {
            console.log(`Sending adapted test results to webview:`, {
              command: 'displayAdaptedPenetrationTestResult',
              attemptNumber,
              success: newTestResult.success,
              exploitSuccess: newTestResult.exploitSuccess,
              filePath: adaptResult.filePath,
              output: newTestResult.output,
              securityImplication: newTestResult.securityImplication || "No security implications detected",
              previousFilePath: params.testFilePath
            });
            
            provider.webview.postMessage({
              command: 'displayAdaptedPenetrationTestResult',
              attemptNumber: attemptNumber,
              success: true, // Always set to true to ensure display
              exploitSuccess: newTestResult.exploitSuccess,
              output: newTestResult.output,
              filePath: adaptResult.filePath,
              securityImplication: newTestResult.securityImplication || "Additional testing recommended",
              previousFilePath: params.testFilePath,
              vulnerabilityName: params.vulnerabilityName || "Unknown Vulnerability" // Include vulnerability name
            });
          }
          
          // Show notification with result
          if (newTestResult.exploitSuccess) {
            vscode.window.showWarningMessage(
              `⚠️ Adapted test (attempt ${attemptNumber}) successfully exploited the vulnerability!`
            );
          } else {
            vscode.window.showInformationMessage(
              `Adapted test (attempt ${attemptNumber}) did not exploit the vulnerability.`
            );
          }
        });
      } catch (error) {
        console.error("❌ Error adapting and running test:", error);
        vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        // Always ensure loading state is reset
        if (provider && provider.webview) {
          provider.webview.postMessage({
            command: 'stopLoading'
          });
        }
      }
    }),

    // Register a command to run a penetration test and return its output
    vscode.commands.registerCommand('testsidebarextension.runPenetrationTest', async (testFileUri) => {
      return await runPenetrationTest(testFileUri.fsPath);
    }),

    // Generate security report command
    vscode.commands.registerCommand('testsidebarextension.generateSecurityReport', async () => {
      try {
        // Show progress notification
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Generating security report...",
          cancellable: false
        }, async (progress) => {
          // Get test results from state
          if (!multipleTestResults || multipleTestResults.length === 0) {
            throw new Error('No test results available. Run penetration tests first.');
          }
          
          // Get contract code from temp file or active editor
          let contractCode = '';
          let contractName = 'Unknown';
          
          try {
            if (fs.existsSync(TEMP_FILE_PATH)) {
              contractCode = fs.readFileSync(TEMP_FILE_PATH, 'utf8');
              // Extract contract name from code
              const match = contractCode.match(/contract\s+(\w+)/);
              if (match && match[1]) {
                contractName = match[1];
              }
            } else {
              const editor = vscode.window.activeTextEditor;
              if (editor) {
                contractCode = editor.document.getText();
                // Try to extract contract name from filename if possible
                const fileName = path.basename(editor.document.fileName, '.sol');
                if (fileName) {
                  contractName = fileName;
                }
              }
            }
          } catch (error) {
            console.error('Error reading contract code:', error);
          }
          
          if (!contractCode) {
            throw new Error('No contract code available');
          }
          
          // Generate the security report
          const reportResult = await generateSecurityReport(
            contractCode,
            contractName,
            multipleTestResults
          );
          
          if (reportResult.success && reportResult.filePath) {
            // Open the report in the editor
            const reportUri = vscode.Uri.file(reportResult.filePath);
            await vscode.window.showTextDocument(reportUri);
            
            vscode.window.showInformationMessage(`Security report generated successfully!`);
          } else {
            throw new Error(reportResult.error || 'Failed to generate security report');
          }
        });
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error generating security report: ${error.message}`);
      }
    }),

    // Run and refine penetration test command
    vscode.commands.registerCommand('venice.runAndRefineTest', async () => {
      try {
        // Get the active editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage("No active editor found");
          return;
        }
        
        // Check if this is a test file
        const filePath = editor.document.uri.fsPath;
        if (!filePath.includes('test') || !filePath.endsWith('.ts')) {
          vscode.window.showErrorMessage("Please select a TypeScript test file");
          return;
        }
        
        // Get the contract name and code (you'll need to implement this)
        const { contractCode, contractName } = await getContractFromTest(filePath);
        
        // Create a progress notification
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Running and refining penetration test",
          cancellable: true
        }, async (progress, token) => {
          
          // Show initial progress
          progress.report({ increment: 0, message: "Starting test..." });
          
          const result = await runAndRefineTestUntilSuccess(
            contractCode,
            contractName,
            filePath,
            5 // Increased from 3 to 5
          );
          
          if (result.success) {
            if (result.exploitSuccess) {
              vscode.window.showInformationMessage(
                `✅ Vulnerability successfully exploited after ${result.cycles} cycles!`,
                "View Test"
              ).then(selection => {
                if (selection === "View Test") {
                  vscode.workspace.openTextDocument(result.finalTestPath!)
                    .then(doc => vscode.window.showTextDocument(doc));
                }
              });
            } else {
              vscode.window.showInformationMessage(
                `Contract appears secure after ${result.cycles} test cycles: ${result.securityImplication}`,
                "View Analysis"
              );
            }
          } else {
            vscode.window.showErrorMessage(`Error in test refinement: ${result.output}`);
          }
          
          return result;
        });
        
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
      }
    }),

    vscode.commands.registerCommand('venice.updateTestStatus', (status) => {
      if (provider && provider.webview) {
        provider.webview.postMessage({
          command: 'updateTestStatus',
          ...status
        });
      }
    }),

    // Add this new command to your extension.ts
    vscode.commands.registerCommand('venice.runMultipleTests', async () => {
      try {
        // Get all penetration test files
        const workspacePath = fileUtils.getWorkspacePath();
        if (!workspacePath) {
          vscode.window.showErrorMessage("No workspace folder open");
          return;
        }
        
        const testDir = path.join(workspacePath, 'test');
        if (!fs.existsSync(testDir)) {
          vscode.window.showErrorMessage("Test directory not found");
          return;
        }
        
        // Find all penetration test files
        const testFiles = fs.readdirSync(testDir)
          .filter(file => file.includes('PenetrationTest') && file.endsWith('.ts'))
          .map(file => path.join(testDir, file));
        
        if (testFiles.length === 0) {
          vscode.window.showInformationMessage("No penetration test files found");
          return;
        }
        
        // Get the contract code
        const contractCode = fs.existsSync(TEMP_FILE_PATH) 
          ? fs.readFileSync(TEMP_FILE_PATH, 'utf8')
          : "";
        
        if (!contractCode) {
          vscode.window.showErrorMessage("No contract code found. Please analyze a contract first.");
          return;
        }
        
        // Extract contract name from the code
        const contractNameMatch = contractCode.match(/contract\s+(\w+)\s*{/);
        const contractName = contractNameMatch ? contractNameMatch[1] : "Contract";
        
        // Show progress indicator
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Running ${testFiles.length} penetration tests in parallel`,
          cancellable: false
        }, async (progress) => {
          // Run the tests in parallel
          const results = await runMultipleTestsInParallel(
            contractCode,
            contractName,
            testFiles
          );
          
          // Update the UI with results
          if (provider && provider.webview) {
            provider.webview.postMessage({
              command: 'displayMultiplePenetrationTestResults',
              results: results.results.map(result => ({
                vulnerability: extractVulnerabilityFromFilename(result.originalTestPath),
                filePath: result.finalTestPath || result.originalTestPath,
                exploitSuccess: result.exploitSuccess || false,
                output: result.output || '',
                securityImplication: result.securityImplication,
                cycles: result.cycles,
                maxCycles: 5
              }))
            });
          }
          
          return results;
        });
        
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error running tests: ${error.message}`);
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

/**
 * Runs a generated penetration test and returns the result
 * @param testFilePath Path to the TypeScript penetration test file
 * @returns Promise with the test result and output
 */
async function runPenetrationTest(testFilePath: string): Promise<{
  success: boolean;
  exploitSuccess?: boolean;
  output: string;
  securityImplication?: string;
  failureAnalysis?: {
    isSecure: boolean;
    failureType: string;
    explanation: string;
    suggestedFix?: string;
  }
}> {
  return new Promise(async (resolve) => {
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
      let vulnerabilityType = '';
      
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
        
        // Try to extract vulnerability type from filename or test content
        const fileNameMatch = path.basename(testFilePath).match(/penetrationTest-[^-]+-(.+)\.ts$/);
        if (fileNameMatch && fileNameMatch[1]) {
          vulnerabilityType = fileNameMatch[1];
        } else if (testPurpose) {
          // Try to extract from test purpose if not in filename
          const vulnTypeMatch = testPurpose.match(/(Reentrancy|Access Control|Integer|Overflow|Underflow|Logic|Front-running)/i);
          if (vulnTypeMatch) {
            vulnerabilityType = vulnTypeMatch[1];
          }
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
      
      testProcess.on('close', async (code) => {
        outputChannel.appendLine(`\nPenetration test finished with code ${code}`);
        
        const testRanSuccessfully = code === 0;
        let exploitSuccess = testRanSuccessfully;
        
        // Extract vulnerability summary from test output
        const vulnerabilitySummaryMatch = testOutput.match(/VULNERABILITY SUMMARY: (.*?)(?:\n|$)/);
        let securityImplication = '';
        
        if (vulnerabilitySummaryMatch && vulnerabilitySummaryMatch[1]) {
          securityImplication = vulnerabilitySummaryMatch[1].trim();
          outputChannel.appendLine(`\nVulnerability: ${securityImplication}`);
        }
        
        // If test failed, analyze the failure reason using the new functions
        let failureAnalysis = undefined;
        if (!testRanSuccessfully) {
          outputChannel.appendLine('\nAnalyzing test failure...');
          
          try {
            // Load the contract code for analysis
            let contractCode = '';
            
            // Try to find contract code from temp file or active editor
            if (fs.existsSync(TEMP_FILE_PATH)) {
              contractCode = fs.readFileSync(TEMP_FILE_PATH, 'utf8');
            } else {
              const editor = vscode.window.activeTextEditor;
              if (editor && editor.document.fileName.endsWith('.sol')) {
                contractCode = editor.document.getText();
              }
            }
            
            if (contractCode) {
              failureAnalysis = await analyzeTestFailure(
                testOutput, 
                contractCode, 
                vulnerabilityType || 'Unknown'
              );
              
              // NEW: Automatically refine the test if it failed due to technical issues
              if (failureAnalysis && !failureAnalysis.isSecure) {
                outputChannel.appendLine("\n🔄 Test failed due to technical issues. Automatically refining test...");
                
                // Extract contract name
                const contractNameMatch = contractCode.match(/contract\s+(\w+)\s*{/);
                const contractName = contractNameMatch ? contractNameMatch[1] : 'HardhatContracts';
                
                // Show notification to user
                vscode.window.showInformationMessage(
                  "Test failed due to technical issues. Automatically refining...",
                  "View Progress"
                ).then(selection => {
                  if (selection === "View Progress") {
                    outputChannel.show();
                  }
                });
                
                // Start the auto-refinement process
                const refinementResult = await runAndRefineTestUntilSuccess(
                  contractCode,
                  contractName,
                  testFilePath,
                  5  // Increased from 3 to 5
                );
                
                if (refinementResult.success && refinementResult.exploitSuccess) {
                  vscode.window.showWarningMessage(
                    `⚠️ Vulnerability successfully exploited after auto-refinement!`,
                    "View Final Test"
                  ).then(selection => {
                    if (selection === "View Final Test") {
                      vscode.workspace.openTextDocument(refinementResult.finalTestPath!)
                        .then(doc => vscode.window.showTextDocument(doc));
                    }
                  });
                  
                  // NEW CODE: Update webview with refined test results
                  if (provider && provider.webview) {
                    // First update the original test result to show it's been refined
                    provider.webview.postMessage({
                      command: 'updateTestRefinementStatus',
                      originalTestPath: testFilePath,
                      status: 'refined'
                    });
                    
                    // Then send the new test result as an adaptation
                    provider.webview.postMessage({
                      command: 'displayAdaptedPenetrationTestResult',
                      attemptNumber: refinementResult.cycles,
                      success: true,
                      exploitSuccess: true,
                      output: refinementResult.output || '',
                      filePath: refinementResult.finalTestPath || '',
                      securityImplication: `Auto-refinement succeeded after ${refinementResult.cycles} cycles: ${refinementResult.securityImplication || 'Vulnerability confirmed'}`,
                      previousFilePath: testFilePath,
                      isAutoRefined: true // Flag to identify auto-refined tests
                    });
                  }
                  
                  // Update the result with the refined test information
                  resolve({
                    success: true,
                    exploitSuccess: true,
                    output: refinementResult.output || testOutput,
                    securityImplication: `Vulnerability confirmed after auto-refinement: ${refinementResult.securityImplication}`,
                    failureAnalysis
                  });
                  return; // Early return to avoid resolving the promise twice
                }
              }
              
              outputChannel.appendLine(`\nFailure analysis: ${failureAnalysis.isSecure ? 'CONTRACT IS SECURE' : 'TEST HAS ISSUES'}`);
              outputChannel.appendLine(`Type: ${failureAnalysis.failureType}`);
              outputChannel.appendLine(`Explanation: ${failureAnalysis.explanation}`);
              if (failureAnalysis.suggestedFix) {
                outputChannel.appendLine(`Suggested fix: ${failureAnalysis.suggestedFix}`);
              }
            } else {
              outputChannel.appendLine('\nCould not analyze test failure - contract code not available');
            }
          } catch (analyzeError) {
            console.error('Error analyzing test failure:', analyzeError);
            if (analyzeError instanceof Error) {
                outputChannel.appendLine(`\nError analyzing test failure: ${analyzeError.message}`);
            } else {
                outputChannel.appendLine(`\nError analyzing test failure: ${String(analyzeError)}`);
            }
          }
        }
        
        // Create the result object with security information
        resolve({
          success: testRanSuccessfully,
          exploitSuccess,
          output: testOutput,
          securityImplication,
          failureAnalysis
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

/**
 * Extracts contract information from a test file
 * 
 * @param testFilePath Path to the test file
 * @returns Contract code and name
 */
async function getContractFromTest(testFilePath: string): Promise<{contractCode: string; contractName: string}> {
  try {
    // Read the test file
    const testContent = fs.readFileSync(testFilePath, 'utf8');
    
    // Try to extract contract name from the test file
    let contractName = 'Unknown';
    
    // Look for contract factory pattern
    const factoryMatch = testContent.match(/getContractFactory\(['"]([\w]+)['"]\)/);
    if (factoryMatch && factoryMatch[1]) {
      contractName = factoryMatch[1];
      console.log(`Extracted contract name from test: ${contractName}`);
    } else {
      // Look for describe block title which might contain contract name
      const describeMatch = testContent.match(/describe\(['"](.*?)['"]/);
      if (describeMatch && describeMatch[1]) {
        // Extract what looks like a contract name
        const possibleName = describeMatch[1].match(/(\w+)\s+(?:Contract|Test|Vulnerability)/i);
        if (possibleName && possibleName[1]) {
          contractName = possibleName[1];
          console.log(`Extracted contract name from describe block: ${contractName}`);
        }
      }
    }

    // Try to get contract code
    // First check if we have it in the global variable or temp file
    let contractCode = '';
    
    if (fs.existsSync(TEMP_FILE_PATH)) {
      contractCode = fs.readFileSync(TEMP_FILE_PATH, 'utf8');
      console.log(`Loaded ${contractCode.length} characters from temp file`);
    } else if (lastAnalyzedCode && lastAnalyzedCode.length > 0) {
      contractCode = lastAnalyzedCode;
      console.log(`Using ${contractCode.length} characters from lastAnalyzedCode`);
    } else {
      // Try to find the contract file in the workspace
      const workspacePath = fileUtils.getWorkspacePath();
      if (workspacePath) {
        // Look in contracts directory (Hardhat standard)
        const contractsDir = path.join(workspacePath, 'contracts');
        if (fs.existsSync(contractsDir)) {
          // Look for a file with the contract name
          const contractFile = path.join(contractsDir, `${contractName}.sol`);
          if (fs.existsSync(contractFile)) {
            contractCode = fs.readFileSync(contractFile, 'utf8');
            console.log(`Found contract file at ${contractFile}`);
          } else {
            // If not found by name, search all .sol files
            const solFiles = await fileUtils.findHardhatContracts();
            for (const file of solFiles) {
              const content = fs.readFileSync(file.path, 'utf8');
              if (content.includes(`contract ${contractName}`)) {
                contractCode = content;
                console.log(`Found contract in ${file.path}`);
                break;
              }
            }
          }
        }
      }
    }
    
    if (!contractCode) {
      throw new Error(`Could not find contract code for ${contractName}`);
    }
    
    return {
      contractCode,
      contractName
    };
  } catch (error: any) {
    console.error('Error extracting contract from test:', error);
    throw new Error(`Failed to extract contract information: ${error.message}`);
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
