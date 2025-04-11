// src/components/Header.tsx
import React from 'react';
import { AppBar, Toolbar, Typography, Box, Button } from '@mui/material';

const Header = () => {
  return (
    <AppBar position="static" color="transparent" elevation={0} sx={{ mb: 4 }}>
      <Toolbar>
        <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
          {/* You can add your logo here */}
        </Box>
        
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Smart Contract Insurance
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            AI-Powered Analyzer with Insurance Services
          </Typography>
        </Box>

        <Box>
          <Button 
            variant="outlined" 
            color="primary" 
            href="https://github.com/yourusername/your-repo" 
            target="_blank"
            sx={{ mr: 2 }}
          >
            GitHub
          </Button>
          <Button 
            variant="contained" 
            color="primary"
          >
            Connect Wallet
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;