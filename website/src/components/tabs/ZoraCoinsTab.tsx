// src/components/tabs/ZoraCoinsTab.tsx
import React, { useState } from 'react';
import { 
  Box, TextField, Button, Typography, CircularProgress, 
  Paper, InputAdornment, Divider, Alert, AlertTitle, Stepper,
  Step, StepLabel, Link, Card, CardContent
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import SecurityIcon from '@mui/icons-material/Security';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import LaunchIcon from '@mui/icons-material/Launch';
import { useWeb3 } from '../../contexts/Web3Context';
import { analyzeContract } from '../../services/AIService';
import { createZoraCoin } from '../../services/zoraService';
import Grid from '../GridWrapper'; // Import our Grid wrapper

// Steps for the coin creation process
const steps = [
  'Analyze Contract',
  'Configure Token',
  'Create Token',
  'Distribution Plan'
];

const ZoraCoinsTab: React.FC = () => {
  const { account, isActive, library, chainId } = useWeb3();
  
  // Contract analysis state
  const [contractCode, setContractCode] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Token configuration state
  const [coinName, setCoinName] = useState('');
  const [coinSymbol, setCoinSymbol] = useState('');
  const [tokenRecommendation, setTokenRecommendation] = useState<any>(null);
  
  // Creation state
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<any>(null);
  
  // UI state
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Check if we're on Base network
  const isBaseNetwork = chainId === 8453; // Base Mainnet
  const isBaseSepoliaNetwork = chainId === 84532; // Base Sepolia testnet
  const isOnBaseNetwork = isBaseNetwork || isBaseSepoliaNetwork;
  
  // Handle switching to Base Sepolia
  const handleSwitchNetwork = async () => {
    if (!library || !library.provider) {
      setError('Wallet connection issue. Please try reconnecting your wallet.');
      return;
    }
    
    // Check if provider.request exists
    if (typeof library.provider.request !== 'function') {
      setError('Your wallet does not support network switching.');
      return;
    }
    
    try {
      await library.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x14a34' }], // 0x14a34 is hex for 84532 (Base Sepolia)
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await library.provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x14a34',
                chainName: 'Base Sepolia',
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://sepolia.base.org'],
                blockExplorerUrls: ['https://sepolia.basescan.org'],
              },
            ],
          });
        } catch (addError) {
          console.error('Error adding Base Sepolia network:', addError);
          setError('Failed to add Base Sepolia network to your wallet.');
        }
      } else {
        console.error('Error switching to Base Sepolia:', switchError);
        setError('Failed to switch to Base Sepolia network.');
      }
    }
  };
  
  // Function to analyze contract and generate recommendations
  const analyzeAndRecommend = async () => {
    if (!contractCode) {
      setError('Please enter contract code first');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Analyze the contract
      const analysisResult = await analyzeContract(contractCode);
      setAnalysis(analysisResult);
      
      // Generate token recommendations based on analysis
      const securityLevel = analysisResult.overall_score > 80 ? 'Safe' : 
                           analysisResult.overall_score > 60 ? 'Secure' : 'Flex';
      
      const recommendedName = `CodeGene ${securityLevel} Token`;
      const recommendedSymbol = `CG${securityLevel.charAt(0)}`;
      
      setTokenRecommendation({
        name: recommendedName,
        symbol: recommendedSymbol,
        distribution: {
          team: 15,
          community: 40,
          treasury: 20,
          liquidity: 25
        }
      });
      
      // Pre-populate form with recommendations
      setCoinName(recommendedName);
      setCoinSymbol(recommendedSymbol);
      
      // Move to next step
      setActiveStep(1);
    } catch (err: any) {
      setError(`Analysis failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to create Zora coin
  const handleCreateCoin = async () => {
    if (!isActive || !account || !library) {
      setError('Please connect your wallet first');
      return;
    }
    
    if (!isOnBaseNetwork) {
      setError('Please switch to Base Sepolia network to create Zora coins');
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
      // Use a placeholder URI for testing
      const uri = `ipfs://placeholder-for-${coinSymbol.toLowerCase()}`;
      
      const result = await createZoraCoin(
        account,
        'https://sepolia.base.org',
        coinName,
        coinSymbol,
        uri 
      );
      
      setCreatedToken({
        address: result.address,
        hash: result.hash,
        timestamp: new Date().toISOString()
      });
      
      setSuccess(`Successfully created Zora Coin: ${result.address}`);
      
      // Move to next step
      setActiveStep(3);
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
  
  // Handle next step
  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };
  
  // Handle back step
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };
  
  // Reset the form
  const handleReset = () => {
    setContractCode('');
    setAnalysis(null);
    setCoinName('');
    setCoinSymbol('');
    setTokenRecommendation(null);
    setCreatedToken(null);
    setActiveStep(0);
    setError('');
    setSuccess('');
  };
  
  // Get the URL to view transaction on Block Explorer
  const getExplorerUrl = (hash: string) => {
    return isBaseSepoliaNetwork
      ? `https://sepolia.basescan.org/tx/${hash}`
      : `https://basescan.org/tx/${hash}`;
  };
  
  return (
    <Box>
      {!isOnBaseNetwork && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Network Change Required</AlertTitle>
          You need to connect to Base Sepolia testnet to create Zora Coins.
          <Button 
            color="inherit" 
            size="small" 
            onClick={handleSwitchNetwork}
            sx={{ mt: 1 }}
          >
            Switch to Base Sepolia
          </Button>
        </Alert>
      )}
      
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      {activeStep === 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            AI-Powered Zora Coin Creation
          </Typography>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>Smart Contract to Zora Coin</AlertTitle>
            Paste your smart contract code below to analyze it and create a Zora Coin on Base Sepolia testnet.
            Our AI will analyze the contract and recommend appropriate parameters for your coin.
          </Alert>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">
              Smart Contract Code
            </Typography>
            <Button 
              startIcon={<ContentPasteIcon />}
              onClick={handlePaste}
              size="small"
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
            startIcon={loading ? <CircularProgress size={20} /> : <AnalyticsIcon />}
            fullWidth
          >
            {loading ? 'Analyzing...' : 'Analyze Contract'}
          </Button>
        </Paper>
      )}
      
      {activeStep === 1 && analysis && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Token Configuration
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    AI Recommendations
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Based on our analysis (score: {analysis.overall_score}/100), we recommend:
                  </Typography>
                  
                  <Typography variant="body1" paragraph>
                    <strong>Name:</strong> {tokenRecommendation?.name}
                  </Typography>
                  
                  <Typography variant="body1" paragraph>
                    <strong>Symbol:</strong> {tokenRecommendation?.symbol}
                  </Typography>
                  
                  <Typography variant="body1" paragraph>
                    <strong>Distribution:</strong> Team ({tokenRecommendation?.distribution.team}%), 
                    Community ({tokenRecommendation?.distribution.community}%), 
                    Treasury ({tokenRecommendation?.distribution.treasury}%), 
                    Liquidity ({tokenRecommendation?.distribution.liquidity}%)
                  </Typography>
                  
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      Higher security score means lower risk tokenomics with more even distribution.
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Token Name"
                variant="outlined"
                value={coinName}
                onChange={(e) => setCoinName(e.target.value)}
                placeholder="Enter a name for your token"
                sx={{ mb: 3 }}
              />
              
              <TextField
                fullWidth
                label="Token Symbol"
                variant="outlined"
                value={coinSymbol}
                onChange={(e) => setCoinSymbol(e.target.value)}
                placeholder="Enter a symbol (e.g., BTC)"
                sx={{ mb: 3 }}
              />
              
              <Alert severity="warning">
                <AlertTitle>Important</AlertTitle>
                This will create a real Zora Coin on Base Sepolia testnet. Make sure your details are correct.
              </Alert>
            </Grid>
          </Grid>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button
              variant="outlined"
              onClick={handleBack}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!coinName || !coinSymbol}
            >
              Continue
            </Button>
          </Box>
        </Paper>
      )}
      
      {activeStep === 2 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Create Your Zora Coin
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>Final Review</AlertTitle>
            You're about to create a Zora Coin on Base Sepolia testnet with the following details:
          </Alert>
          
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Token Name:</Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>{coinName}</Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Token Symbol:</Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>{coinSymbol}</Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Network:</Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>Base Sepolia Testnet</Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Creator:</Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : 'Not connected'}
              </Typography>
            </Grid>
          </Grid>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button
              variant="outlined"
              onClick={handleBack}
            >
              Back
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleCreateCoin}
              disabled={creating || !isActive || !isOnBaseNetwork}
              startIcon={creating ? <CircularProgress size={20} /> : <MonetizationOnIcon />}
            >
              {creating ? 'Creating...' : 'Create Zora Coin'}
            </Button>
          </Box>
        </Paper>
      )}
      
      {activeStep === 3 && createdToken && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Success! Your Zora Coin is Created
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Alert severity="success" sx={{ mb: 3 }}>
            <AlertTitle>Congratulations!</AlertTitle>
            Your token has been successfully created on Base Sepolia testnet.
          </Alert>
          
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">Token Address:</Typography>
              <Typography variant="body1" sx={{ mb: 2, wordBreak: 'break-all' }}>
                {createdToken.address}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">Transaction Hash:</Typography>
              <Link 
                href={getExplorerUrl(createdToken.hash)} 
                target="_blank"
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {createdToken.hash}
                </Typography>
                <LaunchIcon fontSize="small" sx={{ ml: 0.5 }} />
              </Link>
            </Grid>
          </Grid>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            Next Steps
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    1. Add to Wallet
                  </Typography>
                  <Typography variant="body2">
                    Add your token to MetaMask or another wallet to track your balance.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    2. Distribute Tokens
                  </Typography>
                  <Typography variant="body2">
                    Send tokens to your community, team members, or other stakeholders.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    3. Add Liquidity
                  </Typography>
                  <Typography variant="body2">
                    Add liquidity to enable trading of your token on Zora.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Button
              variant="outlined"
              onClick={handleReset}
              startIcon={<AnalyticsIcon />}
            >
              Create Another Token
            </Button>
          </Box>
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