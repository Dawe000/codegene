import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SidebarWebViewProvider } from './webviewProvider';
import { getSolAndRustFileNames, getGroupedFileNames } from './fileNameUtils';
import { analyzeContract, generateExploit, generateHardhatTest } from './veniceService';

// Create a dedicated output channel
let outputChannel: vscode.OutputChannel;

// Make provider accessible from both functions
let provider: SidebarWebViewProvider;

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
    
    vscode.commands.registerCommand('testsidebarextension.downloadAllExploits', async (vulnerabilityType: string, exploits: any[]) => {
      if (!vscode.window.activeTextEditor) {
        vscode.window.showWarningMessage('No file is currently open');
        return;
      }
      
      const contractCode = vscode.window.activeTextEditor.document.getText();
      
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
      
      if (!vscode.window.activeTextEditor) {
        vscode.window.showWarningMessage('No file is currently open');
        return;
      }
      const contractCode = vscode.window.activeTextEditor.document.getText();
      await generateAndSaveHardhatTest(vulnerabilityType, contractCode);
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
function showFiles(provider?: SidebarWebViewProvider) {
  try {
    // Still log to output channel
    outputChannel.appendLine('===== FINDING SOLIDITY & RUST FILES =====');
    
    // Get the filenames
    getSolAndRustFileNames()
      .then(files => {
        // Show in output channel
        outputChannel.appendLine(`\nFound ${files.length} files:`);
        files.forEach(file => outputChannel.appendLine(`- ${file}`));
        
        // Send to webview if provider exists
        if (provider && provider.webview) {
          // Send the filenames to the webview
          provider.webview.postMessage({
            command: 'displayFiles',
            files: files
          });
        }
      })
      .catch(err => {
        outputChannel.appendLine(`\nERROR: ${err.message}`);
      });
  } catch (error) {
    console.error('Error in showFiles:', error);
    vscode.window.showErrorMessage('Error showing files. See console for details.');
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
 * Combines multiple exploits into a single test file
 */
async function combineAndSaveExploits(vulnerabilityType: string, contractCode: string, exploits: any[]) {
  try {
    if (!exploits || exploits.length === 0) {
      vscode.window.showWarningMessage('No exploits to combine');
      return;
    }
    
    console.log(`Combining ${exploits.length} exploits for ${vulnerabilityType}`);
    console.log('Exploits data:', JSON.stringify(exploits.map(e => ({ 
      name: e.vulnerability_name || e.name, 
      hasHardhatTest: !!e.hardhat_test 
    }))));
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder is open');
      return;
    }
    
    // Create test directory if it doesn't exist
    const testDir = path.join(workspaceFolders[0].uri.fsPath, 'test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Combine all exploits into a single file
    const fileName = `Combined_${vulnerabilityType.replace(/\s+/g, '_')}_Exploits.js`;
    const filePath = path.join(testDir, fileName);
    
    let combinedCode = `// Combined Exploit Tests for ${vulnerabilityType}\n`;
    combinedCode += `// Generated on ${new Date().toLocaleString()}\n\n`;
    combinedCode += `const { expect } = require("chai");\n`;
    combinedCode += `const { ethers } = require("hardhat");\n\n`;
    combinedCode += `describe("${vulnerabilityType} Vulnerability Tests", function() {\n`;
    
    // Add each exploit as a separate test
    for (const exploit of exploits) {
      // Get exploit name - handle different property names
      const exploitName = exploit.vulnerability_name || exploit.name || 'Unnamed Exploit';
      const severity = exploit.severity || 'Unknown';
      
      if (!exploit.hardhat_test) {
        // If no hardhat_test, try to generate one from exploit_code
        if (exploit.exploit_code) {
          combinedCode += `\n  // ${exploitName} - ${severity} Severity\n`;
          combinedCode += `  it("should test ${exploitName}", async function() {\n`;
          combinedCode += `    // Placeholder: This was generated from exploit_code\n`;
          combinedCode += `    // Original exploit code:\n`;
          
          const cleanExploitCode = exploit.exploit_code
            .replace(/^```[\w-]*\n/m, '')
            .replace(/\n```$/m, '')
            .split('\n')
            .map((line: string) => `    // ${line}`)
            .join('\n');
            
          combinedCode += cleanExploitCode + '\n\n';
          combinedCode += `    // TODO: Convert this to a working Hardhat test\n`;
          combinedCode += `    // This is a placeholder test\n`;
          combinedCode += `    // Deploy the vulnerable contract\n`;
          combinedCode += `    const ContractFactory = await ethers.getContractFactory("VulnerableContract");\n`;
          combinedCode += `    const contract = await ContractFactory.deploy();\n`;
          combinedCode += `    await contract.deployed();\n\n`;
          combinedCode += `    // Basic assertion to make test pass\n`;
          combinedCode += `    expect(await contract.address).to.be.properAddress;\n`;
          combinedCode += `  });\n`;
          continue;
        } else {
          // Skip this exploit if it has no code
          console.log(`Skipping exploit "${exploitName}" as it has no hardhat_test or exploit_code`);
          continue;
        }
      }
      
      // Clean the hardhat test code
      let testCode = exploit.hardhat_test;
      testCode = testCode.replace(/^```[\w-]*\n/m, '');
      testCode = testCode.replace(/\n```$/m, '');
      
      console.log(`Processing exploit "${exploitName}"`);
      console.log(`Test code length: ${testCode.length} characters`);
      
      // Check if the test code is empty
      if (!testCode.trim()) {
        console.log(`Empty test code for "${exploitName}", skipping`);
        continue;
      }
      
      // Extract imports and setup code
      const importMatches = testCode.match(/^const .* = require\([^)]*\);/gm);
      if (importMatches && importMatches.length > 0) {
        // Add these to the top of the file if not already included
        for (const importLine of importMatches) {
          if (!combinedCode.includes(importLine)) {
            // Find the location after the existing imports
            const lastImportIndex = combinedCode.lastIndexOf('require');
            if (lastImportIndex > 0) {
              const insertIndex = combinedCode.indexOf('\n', lastImportIndex) + 1;
              combinedCode = combinedCode.slice(0, insertIndex) + 
                             importLine + '\n' + 
                             combinedCode.slice(insertIndex);
            }
          }
        }
      }
      
      // Extract the describe block content using a more flexible regex
      const describeMatch = testCode.match(/describe\([^{]*{([\s\S]*?)}\)\;?\s*$/);
      
      if (describeMatch && describeMatch[1]) {
        // Extract just the test content, not the describe wrapper
        combinedCode += `\n  // ${exploitName} - ${severity} Severity\n`;
        combinedCode += `  it("should test ${exploitName}", async function() {\n`;
        
        // Extract the it block content or use the whole describe content
        const itMatch = describeMatch[1].match(/it\([^{]*{([\s\S]*?)}\)\;/);
        if (itMatch && itMatch[1]) {
          combinedCode += `    ${itMatch[1].trim()}\n`;
        } else {
          // If no it block found, use the describe content with indentation
          // Skip any before/after hooks
          const content = describeMatch[1]
            .replace(/beforeEach\([^{]*{[\s\S]*?}\)\;/g, '')
            .replace(/afterEach\([^{]*{[\s\S]*?}\)\;/g, '')
            .trim();
            
          combinedCode += content.split('\n')
            .map((line: string) => line.trim() ? `    ${line}` : line)
            .join('\n');
        }
        
        combinedCode += `  });\n`;
      } else {
        // If no describe block found, look for standalone it blocks
        const itBlockMatch = testCode.match(/it\([^{]*{([\s\S]*?)}\)\;/);
        if (itBlockMatch && itBlockMatch[1]) {
          combinedCode += `\n  // ${exploitName} - ${severity} Severity\n`;
          combinedCode += `  it("should test ${exploitName}", async function() {\n`;
          combinedCode += `    ${itBlockMatch[1].trim()}\n`;
          combinedCode += `  });\n`;
        } else {
          // Fallback: just include the entire test with a comment
          combinedCode += `\n  // ${exploitName} - ${severity} Severity (Raw Test)\n`;
          combinedCode += `  it("should test ${exploitName}", async function() {\n`;
          
          // Try to extract the core test functionality, removing imports and wrapper boilerplate
          const cleanedCode = testCode
            .replace(/^const .* = require\([^)]*\);/gm, '')
            .replace(/describe\([^{]*{/g, '')
            .replace(/}\)\;?\s*$/g, '')
            .trim();
            
          combinedCode += cleanedCode.split('\n')
            .map((line: string) => line.trim() ? `    ${line}` : line)
            .join('\n');
            
          combinedCode += `  });\n`;
        }
      }
    }
    
    combinedCode += `});\n`;
    
    // Write the combined file
    fs.writeFileSync(filePath, combinedCode);
    
    // Open the file
    const document = await vscode.workspace.openTextDocument(filePath);
    vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside });
    
    vscode.window.showInformationMessage(`Combined exploit tests saved to: ${fileName}`);
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
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder is open');
      return null;
    }
    
    // Create test directory if it doesn't exist
    const testDir = path.join(workspaceFolders[0].uri.fsPath, 'test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
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
      
      // Write the file
      const fileName = `${vulnerabilityType.replace(/\s+/g, '_')}_ExploitTest.js`;
      const filePath = path.join(testDir, fileName);
      fs.writeFileSync(filePath, hardhatTest);
      
      // Open the file
      const document = await vscode.workspace.openTextDocument(filePath);
      vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside });
      
      vscode.window.showInformationMessage(`Hardhat exploit test saved to: ${fileName}`);
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
