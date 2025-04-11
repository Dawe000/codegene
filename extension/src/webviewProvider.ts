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
    
    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(message => {
      console.log('Received message from webview:', message.command);
      
      switch (message.command) {
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
      }
    });
  }
}