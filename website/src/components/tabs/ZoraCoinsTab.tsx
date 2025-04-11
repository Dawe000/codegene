// src/components/tabs/ZoraCoinsTab.tsx - Updated version
import React, { useState } from 'react';
import { 
  Box, TextField, Button, Typography, CircularProgress, 
  Paper, InputAdornment, Divider, Alert, AlertTitle
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { createCoinCall } from '@zoralabs/coins-sdk';
import { Address } from 'viem';
import { analyzeContract } from '../../services/AIService';
import { useWeb3 } from '../../contexts/Web3Context';
import { createZoraCoin } from '../../services/zoraService';

const ZoraCoinsTab = () => {
  const { account, isActive, library } = useWeb3();
  const [contractCode, setContractCode] = useState('');
  const [coinName, setCoinName] = useState('');
  const [coinSymbol, setCoinSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Function to recommend coin params based on contract analysis
  const analyzeAndRecommend = async () => {
    if (!contractCode) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await analyzeContract(contractCode);
      setAnalysis(result);
      
      // Auto-suggest name and symbol based on contract analysis
      if (result && result.overall_score) {
        const securityLevel = result.overall_score > 80 ? 'Safe' : 
                             result.overall_score > 60 ? 'Secure' : 'Flex';
        setCoinName(`CodeGene ${securityLevel} Token`);
        setCoinSymbol(`CG${securityLevel.substring(0, 1)}`);
      }
      
    } catch (err) {
      setError('Failed to analyze contract. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle creating the Zora coin
  const handleCreateCoin = async () => {
    if (!isActive || !account) {
      setError('Please connect your wallet first');
      return;
    }
    
    if (!coinName || !coinSymbol) {
      setError('Please provide both coin name and symbol');
      return;
    }
    
    setCreating(true);
    setError('');
    setSuccess('');
    
    try {
      // Generate a simple metadata URI (in production, you would create real IPFS metadata)
      const metadataUri = `ipfs://placeholder-for-${coinSymbol.toLowerCase()}`;
      
      // Use the service to create the coin
      const result = await createZoraCoin(
        account,
        'https://mainnet.base.org', // Use appropriate RPC URL
        coinName,
        coinSymbol,
        metadataUri
      );
      
      setSuccess(`Successfully created Zora Coin! Transaction: ${result.hash}`);
    } catch (err: any) {
      console.error('Error creating Zora coin:', err);
      setError(`Failed to create Zora coin: ${err.message || 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };
  
  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setContractCode(clipboardText);
    } catch (err) {
      setError("Failed to access clipboard. Please paste manually.");
    }
  };
  
  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          AI-Powered Zora Coin Creation
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Smart Contract to Zora Coin</AlertTitle>
          Paste your smart contract code below to analyze it and create a Zora Coin on Base network.
          Our AI will analyze the contract and recommend appropriate parameters for your coin.
        </Alert>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1">
            Smart Contract Code
          </Typography>
          <Button 
            startIcon={<ContentPasteIcon />}
            onClick={handlePaste}
          >
            Paste
          </Button>
        </Box>
        
        <TextField
          fullWidth
          multiline
          rows={8}
          variant="outlined"
          value={contractCode}
          onChange={(e) => setContractCode(e.target.value)}
          placeholder="Paste your smart contract code here..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <CodeIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        
        <Button
          variant="contained"
          color="primary"
          onClick={analyzeAndRecommend}
          disabled={loading || !contractCode}
          fullWidth
        >
          {loading ? <CircularProgress size={24} /> : 'Analyze Contract'}
        </Button>
      </Paper>
      
      {analysis && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Coin Creation
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <TextField
            fullWidth
            label="Coin Name"
            variant="outlined"
            value={coinName}
            onChange={(e) => setCoinName(e.target.value)}
            placeholder="Enter a name for your coin"
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="Coin Symbol"
            variant="outlined"
            value={coinSymbol}
            onChange={(e) => setCoinSymbol(e.target.value)}
            placeholder="Enter a symbol (e.g., BTC)"
            sx={{ mb: 3 }}
          />
          
          <Button
            variant="contained"
            color="secondary"
            startIcon={<MonetizationOnIcon />}
            disabled={creating || !coinName || !coinSymbol}
            onClick={handleCreateCoin}
            fullWidth
          >
            {creating ? <CircularProgress size={24} /> : 'Create Zora Coin'}
          </Button>
        </Paper>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {success}
        </Alert>
      )}
    </Box>
  );
};

export default ZoraCoinsTab;