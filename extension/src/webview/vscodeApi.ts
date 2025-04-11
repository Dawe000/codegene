// Acquire VS Code API (only call this once)
declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

// Initialize VS Code API once and export it
export const vscode = acquireVsCodeApi();