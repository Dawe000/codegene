import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SidebarWebViewProvider } from './webviewProvider';
import { getSolAndRustFileNames, getGroupedFileNames } from './fileNameUtils';
import { analyzeContract } from './veniceService';

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

// Helper function to set loading state
function setIsLoading(loading: boolean) {
  if (provider && provider.webview) {
    provider.webview.postMessage({
      command: loading ? 'startLoading' : 'stopLoading'
    });
  }
}

export function deactivate() {}
