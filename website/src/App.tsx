// src/App.tsx
import React, { useEffect } from 'react';
import { Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Web3ReactProvider } from '@web3-react/core';
import { ethers } from 'ethers';
import Header from './components/Header';
import { Web3Provider } from './contexts/Web3Context';
import AuditorTabs from './components/AuditorTabs';
import { Web3Context } from 'web3';

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
  useEffect(() => {
    console.log("[Environment Check]", {
      nodeEnv: process.env.NODE_ENV,
      apiUrl: process.env.REACT_APP_PORTIA_API_URL || 'using default',
      publicUrl: process.env.PUBLIC_URL,
      baseUrl: window.location.origin
    });
  }, []);

  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <Web3Provider>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          <Container maxWidth="lg">
            <Header />
            <AuditorTabs />
          </Container>
        </ThemeProvider>
      </Web3Provider>
    </Web3ReactProvider>
  );
}

export default App;