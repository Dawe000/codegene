import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './App';
import { vscode } from './vscodeApi'; // Use the shared instance

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