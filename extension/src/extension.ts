import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SidebarWebViewProvider } from './webviewProvider';
import { getSolAndRustFileNames, getGroupedFileNames } from './fileNameUtils';
import { analyzeContract, generateExploit, generateHardhatTest } from './veniceService';
import * as fileUtils from './fileUtils';

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
    vscode.commands.registerCommand('testsidebarextension.helloWorld', () => {
      vscode.window.showInformationMessage('Hello World from My Sidebar Extension!');
    }),
    
    vscode.commands.registerCommand('testsidebarextension.saveText', (text: string) => {
      // Save text to global state
      context.globalState.update('savedText', text);
      vscode.window.showInformationMessage('Text saved successfully!');
    }),
    
    vscode.commands.registerCommand('testsidebarextension.clearHistory', () => {
      context.globalState.update('savedText', '');
      vscode.window.showInformationMessage('History cleared!');
    }),
    
    // Add a command to show the output channel
    vscode.commands.registerCommand('testsidebarextension.showFileList', () => {
      showFiles();
    }),
    
    // Add a command to analyze the current file
    vscode.commands.registerCommand('testsidebarextension.analyzeContract', () => {
      analyzeCurrentFile(provider);
    }),
    
    // Add a command to analyze multiple files
    vscode.commands.registerCommand('testsidebarextension.analyzeMultipleFiles', (fileNames: string[]) => {
      analyzeMultipleFiles(fileNames);
    }),
    
    // Update the generateExploit command handler
    vscode.commands.registerCommand('testsidebarextension.generateExploit', async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No file is currently open');
          return;
        }
        
        const document = editor.document;
        if (!document.fileName.endsWith('.sol') && !document.fileName.endsWith('.rs')) {
          vscode.window.showWarningMessage('Only Solidity (.sol) and Rust (.rs) files are supported');
          return;
        }
        
        // Get vulnerability types to choose from
        const vulnerabilityTypes = [
          'Reentrancy',
          'Integer Overflow/Underflow',
          'Access Control',
          'Front-Running',
          'Denial of Service',
          'Logic Error',
          'Flash Loan Attack',
          'Oracle Manipulation',
          'Other (Custom)'
        ];
        
        // Ask the user which vulnerability to exploit
        const vulnerabilityType = await vscode.window.showQuickPick(vulnerabilityTypes, {
          placeHolder: 'Select vulnerability type to exploit'
        });
        
        if (!vulnerabilityType) {
          return; // User cancelled
        }
        
        // If user selected "Other", ask for custom vulnerability type
        let finalVulnerabilityType = vulnerabilityType;
        if (vulnerabilityType === 'Other (Custom)') {
          const customType = await vscode.window.showInputBox({
            placeHolder: 'Enter custom vulnerability type'
          });
          
          if (!customType) {
            return; // User cancelled
          }
          
          finalVulnerabilityType = customType;
        }
        
        // Get the contract code
        const contractCode = document.getText();
        
        // Show progress indicator
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Generating exploit for ${finalVulnerabilityType} vulnerability...`,
          cancellable: false
        }, async (progress) => {
          // Generate the exploit
          const exploit = await generateExploit(contractCode, finalVulnerabilityType);
          
          if (exploit.error) {
            vscode.window.showErrorMessage(`Error generating exploit: ${exploit.error}`);
            return;
          }
          
          // Send to webview if available
          if (provider && provider.webview) {
            provider.webview.postMessage({
              command: 'displayExploit',
              exploit: exploit,
              vulnerabilityType: finalVulnerabilityType
            });
          }
          
          // Ask if user wants to save as a single file
          const saveChoice = await vscode.window.showQuickPick(
            ['Save as a single combined file', 'Save as a separate file'], 
            { placeHolder: 'How would you like to save the exploit test?' }
          );
          
          if (saveChoice === 'Save as a single combined file') {
            // Combine and save as a single file
            await combineAndSaveExploits(finalVulnerabilityType, contractCode, [exploit]);
          } else {
            // Create exploit test file (original behavior)
            if (exploit.hardhat_test) {
              const workspaceFolders = vscode.workspace.workspaceFolders;
              if (workspaceFolders) {
                // Create test directory if it doesn't exist
                const testDir = path.join(workspaceFolders[0].uri.fsPath, 'test');
                if (!fs.existsSync(testDir)) {
                  fs.mkdirSync(testDir, { recursive: true });
                }
                
                // Write the exploit test file
                const fileName = `${exploit.vulnerability_name.replace(/\s+/g, '_')}_Exploit.js`;
                const filePath = path.join(testDir, fileName);
                
                // Clean the hardhat test code
                let testCode = exploit.hardhat_test;
                testCode = testCode.replace(/^```[\w-]*\n/m, '');
                testCode = testCode.replace(/\n```$/m, '');
                
                fs.writeFileSync(filePath, testCode);
                
                // Open the file
                const document = await vscode.workspace.openTextDocument(filePath);
                vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside });
                
                vscode.window.showInformationMessage(`Exploit test saved to: ${fileName}`);
              } else {
                // Fallback to creating a new document if no workspace is open
                const document = await vscode.workspace.openTextDocument({
                  content: exploit.hardhat_test.replace(/^```[\w-]*\n/m, '').replace(/\n```$/m, ''),
                  language: 'javascript'
                });
                
                vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside });
              }
            } else {
              // Fallback to the simple exploit code if no hardhat test is available
              const document = await vscode.workspace.openTextDocument({
                content: `// Exploit for ${exploit.vulnerability_name}\n\n` +
                        `// Description: ${exploit.description}\n\n` +
                        `// Severity: ${exploit.severity}\n\n` +
                        `// Mitigation: ${exploit.mitigation}\n\n` +
                        exploit.exploit_code.replace(/^```[\w-]*\n/m, '').replace(/\n```$/m, ''),
                language: 'javascript'
              });
              
              vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside });
            }
          }
        });
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error generating exploit: ${error.message}`);
      }
    }),
    
    vscode.commands.registerCommand('testsidebarextension.downloadAllExploits', async (vulnerabilityType: string, exploits: any[], fromHardhatAnalysis?: boolean) => {
      console.log(`[downloadAllExploits] Called for ${vulnerabilityType}`);
      console.log(`[downloadAllExploits] fromHardhatAnalysis: ${fromHardhatAnalysis}`);
      console.log(`[downloadAllExploits] lastAnalyzedCode available: ${lastAnalyzedCode ? 'YES' : 'NO'}, length: ${lastAnalyzedCode?.length || 0}`);
      
      let contractCode = '';
      
      // First try to get code from last analyzed code (most reliable)
      if (lastAnalyzedCode) {
        contractCode = lastAnalyzedCode;
        console.log("[downloadAllExploits] Using lastAnalyzedCode");
      }
      // Then try to get from the active editor
      else if (vscode.window.activeTextEditor) {
        contractCode = vscode.window.activeTextEditor.document.getText();
        console.log("[downloadAllExploits] Using code from active editor");
      } 
      // If no active editor but we're coming from Hardhat analysis, use the stored code
      else if (fromHardhatAnalysis) {
        if (fs.existsSync(TEMP_FILE_PATH)) {
          // Try to recover from temp file
          try {
            contractCode = fs.readFileSync(TEMP_FILE_PATH, 'utf8');
            console.log(`[downloadAllExploits] Recovered ${contractCode.length} characters from temp file`);
          } catch (err) {
            console.error('[downloadAllExploits] Failed to read from temp file:', err);
          }
        }
      }
      
      // If still no code, show error and return
      if (!contractCode) {
        vscode.window.showWarningMessage('No contract code available. Please open a contract file or analyze contracts first.');
        return;
      }
      
      // Ask the user which generation method to use
      const choice = await vscode.window.showQuickPick(
        [
          'Generate an optimized Hardhat test (recommended)',
          'Combine existing exploits (may not be fully functional)'
        ],
        { placeHolder: 'How would you like to generate the exploit test?' }
      );
      
      if (!choice) {
        return; // User cancelled
      }
      
      if (choice === 'Generate an optimized Hardhat test (recommended)') {
        await generateAndSaveHardhatTest(vulnerabilityType, contractCode);
      } else {
        await combineAndSaveExploits(vulnerabilityType, contractCode, exploits);
      }
    }),
    
    vscode.commands.registerCommand('testsidebarextension.generateHardhatTest', async (vulnerabilityType: string, severity?: string) => {
      console.log(`Generating Hardhat test for ${vulnerabilityType} vulnerability with severity ${severity || 'unknown'}`);
      
      let contractCode = '';
      
      // Try to get contract code from the active editor if available
      if (vscode.window.activeTextEditor) {
        contractCode = vscode.window.activeTextEditor.document.getText();
      } 
      // If no active editor but we have stored code from Hardhat analysis, use that
      else if (lastAnalyzedCode) {
        contractCode = lastAnalyzedCode;
      } 
      // If no source is available, show error and return
      else {
        vscode.window.showWarningMessage('No contract code available. Please open a contract file or analyze contracts first.');
        return;
      }
      
      await generateAndSaveHardhatTest(vulnerabilityType, contractCode);
    }),

    vscode.commands.registerCommand('testsidebarextension.analyzeAllContracts', () => {
      analyzeHardhatContracts(provider);
    })
  );
  
  // Add context menu for Solidity and Rust files
  context.subscriptions.push(
    vscode.commands.registerCommand('testsidebarextension.analyzeContractFromExplorer', (fileUri) => {
      analyzeFileByUri(fileUri);
    })
  );
  
  // Show files on activation and send to webview
  showFiles(provider);
  
  console.log('Sidebar extension activated successfully!');
}

/**
 * Shows files in the output channel and sends them to the webview
 */
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

/**
 * Analyzes the currently active file in the editor
 */
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

/**
 * Analyzes a file by its URI (used for context menu in explorer)
 */
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

/**
 * Analyzes multiple files
 */
async function analyzeMultipleFiles(fileNames: string[]) {
  try {
    if (!fileNames || fileNames.length === 0) {
      vscode.window.showWarningMessage('No files selected for analysis');
      return;
    }
    
    setIsLoading(true);
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder is open');
      return;
    }
    
    // Get all files with .sol or .rs extension
    const solFiles = await vscode.workspace.findFiles('**/*.sol', '**/node_modules/**');
    const rustFiles = await vscode.workspace.findFiles('**/*.rs', '**/target/**');
    const allFiles = [...solFiles, ...rustFiles];
    
    // Filter files to just the selected ones
    const selectedFiles = allFiles.filter(file => {
      const fileName = path.basename(file.fsPath);
      return fileNames.includes(fileName);
    });
    
    if (selectedFiles.length === 0) {
      vscode.window.showWarningMessage('Could not locate the selected files');
      return;
    }
    
    // Read all file contents
    const fileContents: string[] = [];
    for (const file of selectedFiles) {
      const document = await vscode.workspace.openTextDocument(file);
      fileContents.push(`// FILE: ${path.basename(file.fsPath)}\n${document.getText()}`);
    }
    
    // Combine file contents with clear separation between files
    const combinedCode = fileContents.join('\n\n// ==========================================\n\n');
    
    // Store the contract code for later use with test generation
    lastAnalyzedCode = combinedCode;
    
    vscode.window.showInformationMessage(`Analyzing ${selectedFiles.length} files...`);
    
    // Analyze the combined contract
    const result = await analyzeContract(combinedCode);
    
    // Log the results to the console
    console.log('Analysis result:', result);
    
    // Send results to webview
    if (provider && provider.webview) {
      provider.webview.postMessage({
        command: 'displayAnalysis',
        analysis: result,
        fileName: fileNames.join(', ')
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
    console.error('Error analyzing multiple files:', error);
    vscode.window.showErrorMessage(`Error analyzing files: ${error.message}`);
    
    // Send error to webview
    if (provider && provider.webview) {
      provider.webview.postMessage({
        command: 'displayAnalysis',
        analysis: { error: error.message },
        fileName: 'Multiple Files'
      });
    }
  } finally {
    setIsLoading(false);
  }
}

/**
 * Analyzes all contracts in a Hardhat project
 */
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

/**
 * Combines multiple exploits into a single test file
 */
async function combineAndSaveExploits(vulnerabilityType: string, contractCode: string, exploits: any[]) {
  try {
    const filePath = await fileUtils.combineExploitsToFile(vulnerabilityType, contractCode, exploits);
    
    if (filePath) {
      // Open the file
      const document = await vscode.workspace.openTextDocument(filePath);
      vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside });
      
      vscode.window.showInformationMessage(`Combined exploit tests saved to: ${path.basename(filePath)}`);
    }
    
    return filePath;
  } catch (error: any) {
    console.error('Error combining exploits:', error);
    vscode.window.showErrorMessage(`Error combining exploits: ${error.message}`);
    return null;
  }
}

/**
 * Generates and saves a Hardhat test for a specific vulnerability
 */
async function generateAndSaveHardhatTest(vulnerabilityType: string, contractCode: string) {
  try {
    // Create progress notification
    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Generating Hardhat test for ${vulnerabilityType}...`,
      cancellable: false
    }, async (progress) => {
      // Generate a complete hardhat test for this vulnerability type
      let hardhatTest;
      try {
        hardhatTest = await generateHardhatTest(contractCode, vulnerabilityType);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error generating test: ${error.message}`);
        return null;
      }
      
      // Use fileUtils to write the test file
      const fileName = `${vulnerabilityType.replace(/\s+/g, '_')}_ExploitTest.js`;
      const filePath = await fileUtils.writeHardhatTestFile(fileName, hardhatTest);
      
      // Open the file
      const document = await vscode.workspace.openTextDocument(filePath);
      vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside });
      
      vscode.window.showInformationMessage(`Hardhat exploit test saved to: ${path.basename(filePath)}`);
      return filePath;
    });
  } catch (error: any) {
    console.error('Error generating hardhat test:', error);
    vscode.window.showErrorMessage(`Error generating hardhat test: ${error.message}`);
    return null;
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
