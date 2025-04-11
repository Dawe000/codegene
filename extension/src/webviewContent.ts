export function getWebviewContent(tailwindCssUri: string): string {
  return /* html */ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sidebar Example</title>
      <link rel="stylesheet" href="${tailwindCssUri}">
    </head>
    <body class="p-3 text-[var(--vscode-foreground)] bg-[var(--vscode-sideBar-background)]">
      <!-- Header with Tailwind classes -->
      <div class="flex items-center mb-5 text-sm font-bold">
        <span>📋 Example Sidebar</span>
      </div>
      
      <!-- Button row with Tailwind classes -->
      <div class="flex gap-2 mb-4 flex-wrap">
        <button id="helloButton" class="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-none py-1.5 px-3 rounded cursor-pointer hover:bg-[var(--vscode-button-hoverBackground)]">Show Hello</button>
        <button id="currentTimeButton" class="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-none py-1.5 px-3 rounded cursor-pointer hover:bg-[var(--vscode-button-hoverBackground)]">Show Time</button>
        <button id="successButton" class="bg-[var(--vscode-debugIcon-startForeground)] text-[var(--vscode-button-foreground)] border-none py-1.5 px-3 rounded cursor-pointer">Success Message</button>
        <button id="errorButton" class="bg-[var(--vscode-errorForeground)] text-[var(--vscode-button-foreground)] border-none py-1.5 px-3 rounded cursor-pointer">Error Message</button>
      </div>
      
      <!-- Text area with Tailwind classes -->
      <div class="mb-4">
        <textarea id="userInput" class="w-full h-32 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded p-2 font-[var(--vscode-editor-font-family)] resize-vertical" placeholder="Enter some text here..."></textarea>
      </div>
      
      <!-- Action buttons with Tailwind classes -->
      <div class="flex gap-2 mb-4 flex-wrap">
        <button id="saveButton" class="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-none py-1.5 px-3 rounded cursor-pointer hover:bg-[var(--vscode-button-hoverBackground)]">Save Text</button>
        <button id="appendButton" class="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-none py-1.5 px-3 rounded cursor-pointer hover:bg-[var(--vscode-button-hoverBackground)]">Append to Output</button>
      </div>
      
      <!-- Output area with Tailwind classes -->
      <div class="mt-5 border-t border-[var(--vscode-editorWidget-border)] pt-3">
        <h4 class="font-medium mb-2">Output:</h4>
        <div id="outputArea" class="space-y-2"></div>
      </div>
      
      <script>
        const vscode = acquireVsCodeApi();
        const userInput = document.getElementById('userInput');
        const outputArea = document.getElementById('outputArea');
        
        // Hello World button
        document.getElementById('helloButton').addEventListener('click', () => {
          vscode.postMessage({
            command: 'showInfo',
            text: 'Hello from the sidebar!'
          });
        });
        
        // Current Time button
        document.getElementById('currentTimeButton').addEventListener('click', () => {
          const now = new Date().toLocaleTimeString();
          vscode.postMessage({
            command: 'showInfo',
            text: 'Current time: ' + now
          });
        });
        
        // Success Message button
        document.getElementById('successButton').addEventListener('click', () => {
          vscode.postMessage({
            command: 'showInfo',
            text: 'Operation completed successfully!'
          });
        });
        
        // Error Message button
        document.getElementById('errorButton').addEventListener('click', () => {
          vscode.postMessage({
            command: 'showError',
            text: 'Something went wrong!'
          });
        });
        
        // Save Text button
        document.getElementById('saveButton').addEventListener('click', () => {
          const text = userInput.value;
          if (text) {
            vscode.postMessage({
              command: 'saveText',
              text: text
            });
          }
        });
        
        // Append to Output button
        document.getElementById('appendButton').addEventListener('click', () => {
          const text = userInput.value;
          if (text) {
            const outputItem = document.createElement('div');
            // Using Tailwind classes instead of custom class
            outputItem.className = 'my-2 p-2 bg-[var(--vscode-editor-background)] border-l-4 border-[var(--vscode-activityBarBadge-background)] rounded';
            outputItem.textContent = text;
            outputArea.appendChild(outputItem);
            userInput.value = '';
          }
        });
      </script>
    </body>
    </html>
  `;
}