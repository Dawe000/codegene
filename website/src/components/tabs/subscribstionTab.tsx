import React, { useState, useEffect } from 'react';
import { 
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Divider,
  Grid as MuiGrid,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stepper,
  Step,
  StepLabel,
  Slider,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import SecurityIcon from '@mui/icons-material/Security';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CodeIcon from '@mui/icons-material/Code';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LaunchIcon from '@mui/icons-material/Launch';
import CloseIcon from '@mui/icons-material/Close';
import EventIcon from '@mui/icons-material/Event';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { useWeb3 } from '../../contexts/Web3Context';
import { createPolicy, getContractAddress, isContractDeployed, fileClaim, getPolicyDetails, getMyPolicies } from '../../services/insuranceService';

// Create a properly typed Grid component
const Grid = MuiGrid;

// Risk levels for insurance policies
const riskLevels = [
  { value: 'Low', label: 'Low Risk', premium: 2, color: 'success' },
  { value: 'Medium', label: 'Medium Risk', premium: 5, color: 'warning' },
  { value: 'High', label: 'High Risk', premium: 10, color: 'error' }
];

// Duration options for insurance policies
const durationOptions = [
  { value: 30, label: '1 Month' },
  { value: 90, label: '3 Months' },
  { value: 180, label: '6 Months' },
  { value: 365, label: '1 Year' }
];

// Transaction status types
type TransactionStatus = 'pending' | 'confirmed' | 'failed' | null;

// Policy interface
interface Policy {
  id: string;
  contractAddress: string;
  coverageAmount: string;
  premium: string;
  duration: number;
  riskLevel: string;
  startDate: Date;
  endDate: Date;
  txHash?: string;
}

// Full policy details interface
interface PolicyDetails {
  owner: string;
  contractInsured: string;
  coverageAmount: string;
  premiumRate: string;
  expirationDate: Date;
  active: boolean;
}

const SubscriptionTab = () => {
  const { account, library, chainId, isActive } = useWeb3();
  
  // State for policy creation
  const [contractAddress, setContractAddress] = useState('');
  const [coverageAmount, setCoverageAmount] = useState('100000');
  const [riskLevel, setRiskLevel] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePolicies, setActivePolicies] = useState<Policy[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TransactionStatus>(null);
  const [loadingPolicies, setLoadingPolicies] = useState(false); //to load pre exisitng policies 
  
  // State for policy details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [policyDetails, setPolicyDetails] = useState<PolicyDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // State for filing claims
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimAmount, setClaimAmount] = useState('');
  const [claimDescription, setClaimDescription] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  
  // Check if contract is deployed on current network
  const contractDeployed = chainId ? isContractDeployed(chainId) : false;
  
  // Get explorer URL based on chain ID
  const getExplorerUrl = (hash: string) => {
    if (!chainId) return '';
    
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io',
      421614: 'https://sepolia.arbiscan.io',
      137: 'https://polygonscan.com',
      42161: 'https://arbiscan.io',
      10: 'https://optimistic.etherscan.io'
    };
    
    const baseUrl = explorers[chainId] || '';
    return `${baseUrl}/tx/${hash}`;
  };
  
  // Calculate premium automatically
  const getPremiumRate = () => {
    const riskInfo = riskLevels.find(r => r.value === riskLevel);
    return riskInfo ? riskInfo.premium : 5; // Default to 5% if not found
  };
  
  const calculatePremium = () => {
    const premium = parseFloat(coverageAmount) * (getPremiumRate() / 100);
    return premium.toFixed(4);
  };
  
  // Calculate duration-adjusted premium
  const calculateTotalPremium = () => {
    const monthlyPremium = parseFloat(calculatePremium());
    const durationInMonths = duration / 30;
    return (monthlyPremium * durationInMonths).toFixed(4);
  };

  // Policy creation steps
  const steps = [
    'Enter Contract Details',
    'Select Coverage Options',
    'Review & Submit'
  ];
  
  // Handle policy creation
  const handleCreatePolicy = async () => {
    if (!isActive || !library || !account) {
      setError('Please connect your wallet first');
      return;
    }
    
    if (!contractDeployed) {
      setError(`No insurance contract deployed on current network. Please switch to a supported network.`);
      return;
    }
    
    if (!contractAddress || !coverageAmount) {
      setError('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    setTxHash(null);
    setTxStatus('pending');
    
    try {
      // Get the contract address for the current network
      const insuranceContractAddress = chainId ? getContractAddress(chainId) : '';
      
      // Create the policy
      const totalPremium = calculateTotalPremium();
      
      // This will return the transaction receipt and extract the policy ID
      const { policyId, transactionHash, receipt } = await createPolicy(
        library,
        contractAddress,
        coverageAmount,
        duration,
        riskLevel,
        totalPremium
      );
      
      // Set transaction hash for user to see
      setTxHash(transactionHash);
      setTxStatus('confirmed');
      
      setResult(`Policy created successfully! Policy ID: ${policyId}`);
      
      // Add to active policies
      const newPolicy: Policy = {
        id: policyId,
        contractAddress,
        coverageAmount,
        premium: totalPremium,
        duration,
        riskLevel,
        startDate: new Date(),
        endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
        txHash: transactionHash
      };
      
      setActivePolicies([...activePolicies, newPolicy]);
      
      // Reset form
      setActiveStep(0);
      setContractAddress('');
      setCoverageAmount('100000');
      setRiskLevel('Medium');
      setDuration(30);
      
    } catch (err) {
      console.error('Error creating policy:', err);
      setTxStatus('failed');
      setError('Failed to create policy. Please check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle viewing policy details
  const handleViewDetails = async (policy: Policy) => {
    setSelectedPolicy(policy);
    setDetailsModalOpen(true);
    setLoadingDetails(true);
    setPolicyDetails(null);
    
    try {
      if (library && policy.id) {
        const details = await getPolicyDetails(library, parseInt(policy.id));
        setPolicyDetails(details);
      }
    } catch (err) {
      console.error('Error fetching policy details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };
  
  // Handle filing a claim
  const handleFileClaimOpen = (policy: Policy) => {
    setSelectedPolicy(policy);
    setClaimModalOpen(true);
    setClaimAmount('');
    setClaimDescription('');
    setClaimTxHash(null);
  };
  
  const handleSubmitClaim = async () => {
    if (!selectedPolicy || !claimAmount || !claimDescription || !library) {
      return;
    }
    
    setClaimLoading(true);
    
    try {
      const { claimId, transactionHash } = await fileClaim(
        library,
        parseInt(selectedPolicy.id),
        claimAmount,
        claimDescription
      );
      
      setClaimTxHash(transactionHash);
      setResult(`Claim submitted successfully! Claim ID: ${claimId}`);
      // Close the modal after a short delay to show success
      setTimeout(() => {
        setClaimModalOpen(false);
      }, 2000);
    } catch (err) {
      console.error('Error filing claim:', err);
      setError('Failed to submit claim. Please try again.');
    } finally {
      setClaimLoading(false);
    }
  };
  
  // Handle step navigation
  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };
  
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };
  
  // Get color for risk level
  const getRiskColor = (risk: string) => {
    const riskInfo = riskLevels.find(r => r.value === risk);
    return riskInfo ? riskInfo.color : 'default';
  };

  useEffect(() => {
    const fetchExistingPolicies = async () => {
      if (!isActive || !library || !account) {
        return;
      }
      
      setLoadingPolicies(true);
      
      try {
        const policies = await getMyPolicies(library);
        
        // Convert the fetched policies to match our Policy interface
        const formattedPolicies = policies.map((policy: { contractInsured: any; coverageAmount: any; expirationDate: any; }, index: { toString: () => any; }) => ({
          id: index.toString(), // Use index as fallback if no real ID available
          contractAddress: policy.contractInsured,
          coverageAmount: policy.coverageAmount,
          premium: "", // We may not have this info from the contract
          duration: 0, // We may not have this info from the contract
          riskLevel: "Medium", // Default if not available
          startDate: new Date(), // We may not have the start date
          endDate: policy.expirationDate,
          // We don't have txHash for historical policies
        }));
        
        setActivePolicies(formattedPolicies);
      } catch (err) {
        console.error('Error fetching policies:', err);
        setError('Failed to load your existing policies.');
      } finally {
        setLoadingPolicies(false);
      }
    };
    
    fetchExistingPolicies();
  }, [isActive, library, account, chainId]);
  
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Smart Contract Insurance
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Protect your smart contracts with customized insurance policies. Our AI-powered risk assessment 
          determines premium rates based on contract complexity and potential vulnerabilities.
        </Typography>
      </Box>
      
      {!isActive ? (
        <Alert severity="warning">
          <AlertTitle>Wallet Not Connected</AlertTitle>
          Please connect your wallet to access insurance services
        </Alert>
      ) : !contractDeployed ? (
        <Alert severity="warning">
          <AlertTitle>Unsupported Network</AlertTitle>
          Insurance contracts are only available on Arbitrum Sepolia testnet. Please switch your network in MetaMask.
        </Alert>
      ) : (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          
          {activeStep === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Contract Details
              </Typography>
              <TextField
                fullWidth
                label="Contract Address to Insure"
                variant="outlined"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0x..."
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CodeIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!contractAddress}
                >
                  Next
                </Button>
              </Box>
            </Box>
          )}
          
          {activeStep === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Coverage Options
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 3 }}>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    label="Coverage Amount (USD)"
                    variant="outlined"
                    type="number"
                    value={coverageAmount}
                    onChange={(e) => setCoverageAmount(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <AttachMoneyIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
                
                <Box sx={{ flex: 1 }}>
                  <FormControl fullWidth>
                    <InputLabel>Risk Level</InputLabel>
                    <Select
                      value={riskLevel}
                      onChange={(e) => setRiskLevel(e.target.value as 'Low' | 'Medium' | 'High')}
                      label="Risk Level"
                    >
                      {riskLevels.map((level) => (
                        <MenuItem key={level.value} value={level.value}>
                          {level.label} - {level.premium}% Premium
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
              
              <Box sx={{ mt: 3, mb: 3 }}>
                <Typography gutterBottom>Policy Duration</Typography>
                <Box sx={{ px: 2 }}>
                  <Slider
                    value={duration}
                    onChange={(_, newValue) => setDuration(newValue as number)}
                    step={null}
                    marks={durationOptions.map(option => ({
                      value: option.value,
                      label: option.label
                    }))}
                    min={30}
                    max={365}
                  />
                </Box>
              </Box>
              
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
                >
                  Next
                </Button>
              </Box>
            </Box>
          )}
          
          {activeStep === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Review Insurance Policy
              </Typography>
              
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Policy Summary</Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Contract to Insure
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {contractAddress.substring(0, 8)}...{contractAddress.substring(contractAddress.length - 6)}
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Coverage Amount
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        ${parseInt(coverageAmount).toLocaleString()}
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Risk Assessment
                      </Typography>
                      <Chip 
                        label={riskLevel} 
                        color={getRiskColor(riskLevel) as any}
                        size="small"
                      />
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Premium Rate
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {getPremiumRate()}% per month
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Policy Duration
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {durationOptions.find(option => option.value === duration)?.label || `${duration} days`}
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total Premium (ETH)
                      </Typography>
                      <Typography variant="h6" gutterBottom color="primary.main">
                        {calculateTotalPremium()} ETH
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
                <CardActions>
                  <Alert severity="info" sx={{ width: '100%' }}>
                    This premium will be charged to your wallet when you create the policy.
                  </Alert>
                </CardActions>
              </Card>
              
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
                  onClick={handleCreatePolicy}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <SecurityIcon />}
                >
                  Create Policy
                </Button>
              </Box>
            </Box>
          )}
          
          {/* Transaction Status Display */}
          {txStatus && (
            <Box sx={{ mt: 3 }}>
              <Alert 
                severity={txStatus === 'confirmed' ? 'success' : txStatus === 'pending' ? 'info' : 'error'}
                sx={{ mb: 2 }}
              >
                <AlertTitle>
                  {txStatus === 'confirmed' ? 'Transaction Confirmed' : 
                   txStatus === 'pending' ? 'Transaction Pending' : 'Transaction Failed'}
                </AlertTitle>
                {txHash && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>
                      Transaction Hash:
                    </Typography>
                    <Link 
                      href={getExplorerUrl(txHash)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      sx={{ display: 'flex', alignItems: 'center' }}
                    >
                      {txHash.substring(0, 8)}...{txHash.substring(txHash.length - 8)}
                      <LaunchIcon fontSize="small" sx={{ ml: 0.5 }} />
                    </Link>
                  </Box>
                )}
              </Alert>
            </Box>
          )}
        </Paper>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}
      
      {result && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <AlertTitle>Success</AlertTitle>
          {result}
        </Alert>
      )}
      
      {/* Active Policies Section - Updated with loading indicator */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Your Active Policies
          </Typography>
          {loadingPolicies && <CircularProgress size={24} />}
        </Box>
        <Divider sx={{ mb: 2 }} />
        
        {!loadingPolicies && activePolicies.length === 0 ? (
          <Alert severity="info">
            You don't have any active insurance policies. Create one to protect your smart contracts.
          </Alert>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            {activePolicies.map((policy, index) => (
              <Card variant="outlined" key={index}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Policy #{policy.id}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Contract
                    </Typography>
                    <Typography variant="body2">
                      {policy.contractAddress.substring(0, 6)}...{policy.contractAddress.substring(policy.contractAddress.length - 4)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Coverage
                    </Typography>
                    <Typography variant="body2">
                      ${parseInt(policy.coverageAmount).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Risk Level
                    </Typography>
                    <Chip 
                      label={policy.riskLevel} 
                      color={getRiskColor(policy.riskLevel) as any}
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Expires
                    </Typography>
                    <Typography variant="body2">
                      {new Date(policy.endDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                  {policy.txHash && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Transaction
                      </Typography>
                      <Link 
                        href={getExplorerUrl(policy.txHash)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        sx={{ display: 'flex', alignItems: 'center' }}
                      >
                        View
                        <LaunchIcon fontSize="small" sx={{ ml: 0.5 }} />
                      </Link>
                    </Box>
                  )}
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    color="primary"
                    onClick={() => handleViewDetails(policy)}
                  >
                    View Details
                  </Button>
                  <Button 
                    size="small" 
                    color="secondary"
                    onClick={() => handleFileClaimOpen(policy)}
                  >
                    File Claim
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Box>
        )}
      </Paper>
      
      {/* Policy Details Modal */}
      <Dialog 
        open={detailsModalOpen} 
        onClose={() => setDetailsModalOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Policy Details {selectedPolicy && `#${selectedPolicy.id}`}
            </Typography>
            <IconButton onClick={() => setDetailsModalOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {loadingDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : policyDetails ? (
            <Box>
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Coverage Summary
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <ShieldIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Coverage Amount" 
                        secondary={`${policyDetails.coverageAmount} ETH`} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <AttachMoneyIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Premium Rate" 
                        secondary={`${policyDetails.premiumRate}%`} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <EventIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Expiration Date" 
                        secondary={policyDetails.expirationDate.toLocaleDateString()} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        {policyDetails.active ? <CheckCircleIcon color="success" /> : <WarningIcon color="error" />}
                      </ListItemIcon>
                      <ListItemText 
                        primary="Status" 
                        secondary={policyDetails.active ? "Active" : "Inactive"} 
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
  
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Contract Information
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CodeIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Insured Contract" 
                        secondary={policyDetails.contractInsured} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <AssignmentIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Policy Owner" 
                        secondary={policyDetails.owner} 
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
  
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                This policy provides financial protection against verified vulnerabilities, 
                exploits, and specified malfunctions of the insured smart contract.
              </Typography>
            </Box>
          ) : (
            <Alert severity="error">
              Failed to load policy details. Please try again.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          {selectedPolicy && selectedPolicy.txHash && (
            <Button 
              startIcon={<LaunchIcon />}
              href={getExplorerUrl(selectedPolicy.txHash)} 
              target="_blank"
              color="primary"
            >
              View on Explorer
            </Button>
          )}
          <Button onClick={() => setDetailsModalOpen(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* File Claim Modal */}
      <Dialog 
        open={claimModalOpen} 
        onClose={() => !claimLoading && setClaimModalOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              File a Claim {selectedPolicy && `for Policy #${selectedPolicy.id}`}
            </Typography>
            <IconButton 
              onClick={() => !claimLoading && setClaimModalOpen(false)} 
              size="small"
              disabled={claimLoading}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {claimTxHash ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              <AlertTitle>Claim Submitted Successfully</AlertTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" sx={{ mr: 1 }}>
                  Transaction:
                </Typography>
                <Link 
                  href={getExplorerUrl(claimTxHash)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  sx={{ display: 'flex', alignItems: 'center' }}
                >
                  {claimTxHash.substring(0, 8)}...{claimTxHash.substring(claimTxHash.length - 8)}
                  <LaunchIcon fontSize="small" sx={{ ml: 0.5 }} />
                </Link>
              </Box>
            </Alert>
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                <AlertTitle>Filing a Claim</AlertTitle>
                Please provide details about the incident that affected your insured contract.
                Include any relevant information that would help verify your claim.
              </Alert>
  
              <TextField
                label="Claim Amount (ETH)"
                variant="outlined"
                fullWidth
                type="number"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoneyIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
              />
  
              <TextField
                label="Incident Description"
                variant="outlined"
                fullWidth
                multiline
                rows={4}
                value={claimDescription}
                onChange={(e) => setClaimDescription(e.target.value)}
                placeholder="Please describe what happened, when it occurred, and how it impacted your contract..."
                sx={{ mb: 2 }}
              />
  
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Your claim will be reviewed by our team. You may be asked to provide additional evidence
                to support your claim. The approval process typically takes 1-3 business days.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!claimTxHash && (
            <>
              <Button 
                onClick={() => setClaimModalOpen(false)} 
                disabled={claimLoading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitClaim} 
                color="primary"
                variant="contained"
                disabled={!claimAmount || !claimDescription || claimLoading}
                startIcon={claimLoading ? <CircularProgress size={20} /> : <ReceiptIcon />}
              >
                Submit Claim
              </Button>
            </>
          )}
          {claimTxHash && (
            <Button onClick={() => setClaimModalOpen(false)} color="primary">
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SubscriptionTab;