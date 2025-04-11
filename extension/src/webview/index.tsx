import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './App';

// Access the VS Code API
declare global {
  interface Window {
    acquireVsCodeApi: () => any;
  }
}

// Get VS Code API
const vscode = window.acquireVsCodeApi();

// Create root element
const root = document.getElementById('root');
if (root) {
  const reactRoot = ReactDOM.createRoot(root);
  reactRoot.render(
    <React.StrictMode>
      <App vscode={vscode} />
    </React.StrictMode>
  );
}