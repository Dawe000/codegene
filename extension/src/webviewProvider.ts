import * as vscode from 'vscode';
import * as path from 'path';

export class SidebarWebViewProvider implements vscode.WebviewViewProvider {
  public webview?: vscode.Webview;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    // Store the webview reference
    this.webview = webviewView.webview;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    // Add message handler for webview messages
    webviewView.webview.onDidReceiveMessage(async message => {
      console.log("Received message from webview:", message.command);
      
      switch (message.command) {
        case 'adaptPenetrationTest':
          console.log("Received adaptPenetrationTest command:", message);
          vscode.commands.executeCommand('testsidebarextension.adaptAndRunPenetrationTest', {
            testFilePath: message.testFilePath,
            exploitSuccess: message.exploitSuccess,
            attemptNumber: message.attemptNumber || 1
          });
          break;
        case 'showInfo':
          vscode.window.showInformationMessage(message.text);
          break;
        case 'showError':
          vscode.window.showErrorMessage(message.text);
          break;
        case 'saveText':
          vscode.commands.executeCommand('testsidebarextension.saveText', message.text);
          break;
        case 'analyzeSelectedFiles':
          vscode.commands.executeCommand('testsidebarextension.analyzeMultipleFiles', message.fileNames);
          break;
        case 'analyzeAllContracts':
          vscode.commands.executeCommand('testsidebarextension.analyzeAllContracts');
          break;
        case 'startNodeAndDeploy':
          vscode.commands.executeCommand('testsidebarextension.startNodeAndDeploy');
          break;
        case 'stopNode':
          vscode.commands.executeCommand('testsidebarextension.stopNode');
          break;
        case 'generateAndRunPenetrationTest':
          vscode.commands.executeCommand('testsidebarextension.generateAndRunPenetrationTest');
          break;
        case 'generateAndRunMultipleTests':
          vscode.commands.executeCommand('testsidebarextension.generateAndRunMultipleTests', message);
          break;
        case 'openFile':
          if (message.path) {
            const fileUri = vscode.Uri.file(message.path);
            vscode.window.showTextDocument(fileUri);
          }
          break;
        case 'adaptAndRunPenetrationTest':
          vscode.commands.executeCommand('testsidebarextension.adaptAndRunPenetrationTest', message);
          break;
        case 'generateSecurityReport':
          vscode.commands.executeCommand('testsidebarextension.generateSecurityReport');
          break;
      }
    });

    // Get the local paths for our resources
    const scriptUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview.js')
    );
    
    const tailwindCssUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'tailwind.css')
    );
    
    // Create a basic HTML that will load our React app
    webviewView.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smart Contract Analyzer</title>
        <link rel="stylesheet" href="${tailwindCssUri}">
      </head>
      <body>
        <div id="root">Loading...</div>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }

  /**
   * Updates the webview with penetration test results
   * @param testResults Array of test results to display
   */
  public updateTestResults(testResults: any[]) {
    if (!this.webview) {
      console.error("Cannot update results: webview not initialized");
      return;
    }
    
    console.log(`Sending ${testResults.length} test results to webview`);
    
    this.webview.postMessage({
      command: 'displayMultiplePenetrationTestResults',
      testResults: testResults.map(test => ({
        vulnerability: test.vulnerability,
        success: test.success,
        exploitSuccess: test.exploitSuccess,
        output: test.output,
        securityImplication: test.securityImplication,
        filePath: test.filePath,
        failureAnalysis: test.failureAnalysis
      }))
    });
  }
  
  /**
   * Updates the webview with a single penetration test result
   * @param testResult Result of a single test
   */
  public updateSingleTestResult(testResult: any) {
    if (!this.webview) {
      console.error("Cannot update result: webview not initialized");
      return;
    }
    
    console.log("Sending single test result to webview");
    
    this.webview.postMessage({
      command: 'displayPenetrationTestResult',
      ...testResult
    });
  }
}