// src/components/tabs/TokenDistributionTab.tsx
import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Paper, CircularProgress,
  Divider, Alert, AlertTitle, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow
} from '@mui/material';
import { useWeb3 } from '../../contexts/Web3Context';
import Grid from '../GridWrapper'; // Import our Grid wrapper component
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

// Distribution data with colors for visualization
const distributionData = [
  { name: 'Team', value: 20, color: '#8884d8' },
  { name: 'Community', value: 40, color: '#82ca9d' },
  { name: 'Treasury', value: 20, color: '#ffc658' },
  { name: 'Liquidity', value: 20, color: '#ff8042' }
];

// Simple Distribution Chart component
const DistributionChart = () => (
  <Box sx={{ width: '100%', height: 300 }}>
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={distributionData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={100}
          innerRadius={60}
          fill="#8884d8"
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}%`}
        >
          {distributionData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  </Box>
);


// Mock distribution service function for demonstration
const distributeTokens = async (library: any, tokenAddress: string, recipientList: any[]) => {
  // This would be implemented with real functionality in a production app
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
  return {
    success: true,
    hash: '0x' + Math.random().toString(16).substring(2, 34)
  };
};

const TokenDistributionTab = () => {
  const { account, isActive, library } = useWeb3();
  const [tokenAddress, setTokenAddress] = useState('');
  const [recipients, setRecipients] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  const handleDistribute = async () => {
    if (!isActive || !account || !library) {
      setError('Please connect your wallet first');
      return;
    }
    
    if (!tokenAddress) {
      setError('Please enter the token address');
      return;
    }
    
    if (!recipients) {
      setError('Please enter at least one recipient address');
      return;
    }
    
    // Parse the recipients (comma-separated addresses with optional amounts)
    const recipientList = recipients.split('\n').map(line => {
      const [address, amount] = line.split(',').map(part => part.trim());
      return { address, amount: amount || '100' }; // Default to 100 tokens if no amount specified
    });
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const result = await distributeTokens(library, tokenAddress, recipientList);
      setSuccess(`Successfully distributed tokens! Transaction: ${result.hash}`);
    } catch (err: any) {
      console.error('Error distributing tokens:', err);
      setError(`Failed to distribute tokens: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Token Distribution
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Distribute Your Zora Coins</AlertTitle>
          Enter your token address and recipient list to distribute tokens to your community,
          team members, or other stakeholders.
        </Alert>
        
        <TextField
          fullWidth
          label="Token Address"
          variant="outlined"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          placeholder="0x..."
          sx={{ mb: 3 }}
        />
        
        <Typography variant="subtitle1" gutterBottom>
          Recipients (one per line, format: address,amount)
        </Typography>
        
        <TextField
          fullWidth
          multiline
          rows={6}
          variant="outlined"
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="0x123...,100\n0x456...,200"
          sx={{ mb: 3 }}
        />
        
        <Button
          variant="contained"
          color="primary"
          onClick={handleDistribute}
          disabled={loading || !tokenAddress || !recipients}
          fullWidth
        >
          {loading ? <CircularProgress size={24} /> : 'Distribute Tokens'}
        </Button>
      </Paper>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recommended Distribution Strategy
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Allocation</TableCell>
                    <TableCell align="right">Percentage</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {distributionData.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell component="th" scope="row">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box 
                            component="span" 
                            sx={{ 
                              display: 'inline-block', 
                              width: 12, 
                              height: 12, 
                              bgcolor: row.color,
                              mr: 1,
                              borderRadius: '50%'
                            }} 
                          />
                          {row.name}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{row.value}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          <Grid item xs={12} md={6}>
          <Box sx={{ width: '100%', height: 300 }}>
  <DistributionChart />
</Box>
          </Grid>
        </Grid>
        
        <Alert severity="info" sx={{ mt: 3 }}>
          <AlertTitle>Distribution Best Practices</AlertTitle>
          <Typography variant="body2">
            • Team & Advisor tokens: Consider vesting over 1-2 years<br />
            • Community allocation: Use for airdrops, rewards, and engagement<br />
            • Treasury: Reserve for future development and ecosystem growth<br />
            • Liquidity: Add to Zora pools to enable trading
          </Typography>
        </Alert>
      </Paper>
      
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

export default TokenDistributionTab;