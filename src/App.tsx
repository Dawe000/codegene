// src/App.tsx
import React from 'react';
import { Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Web3ReactProvider } from '@web3-react/core';
import { ethers } from 'ethers';

// Function to get library from provider
function getLibrary(provider: any) {
  const library = new ethers.providers.Web3Provider(provider);
  library.pollingInterval = 12000;
  return library;
}

// Create a dark theme for the application
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: '"Roboto Mono", monospace',
  },
});

function App() {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Container maxWidth="lg">
          <h1>Smart Contract Insurance Platform</h1>
          {/* We'll add more components here later */}
        </Container>
      </ThemeProvider>
    </Web3ReactProvider>
  );
}

export default App;