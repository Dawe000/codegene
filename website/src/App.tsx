// src/App.tsx
import React from 'react';
import { Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Web3ReactProvider } from '@web3-react/core';
import { ethers } from 'ethers';
import Header from './components/Header';
import { Web3Provider } from './contexts/Web3Context';

// Function to get library from provider
function getLibrary(provider: any): ethers.providers.Web3Provider {
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
    <Web3ReactProvider getLibrary={getLibrary as any}>
      <Web3Provider>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          <Container maxWidth="lg">
            <Header />
            {/* We'll add more components here later */}
          </Container>
        </ThemeProvider>
      </Web3Provider>
    </Web3ReactProvider>
  );
}

export default App;