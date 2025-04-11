import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  CircularProgress,
  Paper,
  InputAdornment,
  Divider,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  IconButton
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import SearchIcon from '@mui/icons-material/Search';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import { getContractSource } from '../../services/etherscanService';
import { analyzeContract } from '../../services/AIService';

// Define the analysis type
interface CategoryAnalysis {
  score: number;
  details: string[];
  risk_level: 'Low' | 'Medium' | 'High';
}

interface ContractAnalysis {
  overall_score: number;
  complexity: CategoryAnalysis;
  vulnerabilities: CategoryAnalysis;
  upgradability: CategoryAnalysis;
  behavior: CategoryAnalysis;
}

const AuditTab = () => {
  const [loading, setLoading] = useState(false);
  const [contractAddress, setContractAddress] = useState('');
  const [contractCode, setContractCode] = useState('');
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [error, setError] = useState('');

  const handleAddressSubmit = async () => {
    if (!contractAddress) return;
    
    setLoading(true);
    setError('');
    
    try {
      const sourceCode = await getContractSource(contractAddress);
      setContractCode(sourceCode);
    } catch (err) {
      setError('Failed to fetch contract source code. Please check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = async () => {
    if (!contractCode) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await analyzeContract(contractCode);
      setAnalysis(result);
    } catch (err) {
      setError('Failed to analyze contract. Please try again.');
    } finally {
      setLoading(false);
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

  const getRiskColor = (riskLevel: string) => {
    switch(riskLevel.toLowerCase()) {
      case 'low': return 'success.main';
      case 'medium': return 'warning.main';
      case 'high': return 'error.main';
      default: return 'info.main';
    }
  };

  return (
    <Box>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Fetch Contract by Address
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              fullWidth
              label="Contract Address"
              variant="outlined"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="0x..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleAddressSubmit}
              disabled={loading || !contractAddress}
              sx={{ ml: 2, height: '56px' }}
            >
              {loading ? <CircularProgress size={24} /> : 'Fetch'}
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Contract Code
            </Typography>
            <Tooltip title="Paste from clipboard">
              <IconButton onClick={handlePaste} color="primary">
                <ContentPasteIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={10}
            variant="outlined"
            value={contractCode}
            onChange={(e) => setContractCode(e.target.value)}
            placeholder="Paste your smart contract code here or fetch it using a contract address..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CodeIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleAudit}
            disabled={loading || !contractCode}
            startIcon={<AnalyticsIcon />}
            sx={{ mt: 2 }}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Audit Contract'}
          </Button>
        </Paper>

        {error && (
          <Paper sx={{ p: 3, bgcolor: 'error.dark' }}>
            <Typography color="error">{error}</Typography>
          </Paper>
        )}

        {analysis && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Security Analysis Results
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="h4" sx={{ mr: 2 }}>{analysis.overall_score}</Typography>
                <Typography variant="subtitle1">Overall Security Score</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={analysis.overall_score} 
                sx={{ 
                  height: 10, 
                  borderRadius: 5,
                  bgcolor: 'grey.300',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: analysis.overall_score > 80 ? 'success.main' : 
                             analysis.overall_score > 60 ? 'warning.main' : 'error.main'
                  }
                }}
              />
            </Box>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {(['complexity', 'vulnerabilities', 'upgradability', 'behavior'] as const).map((category) => (
                <Paper key={category} elevation={2} sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                      {category}
                    </Typography>
                    <Chip 
                      label={analysis[category].risk_level} 
                      sx={{ 
                        bgcolor: getRiskColor(analysis[category].risk_level),
                        color: 'white',
                        fontWeight: 'bold'
                      }} 
                    />
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>Score: {analysis[category].score}/100</Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={analysis[category].score} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: 'grey.300',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: analysis[category].score > 80 ? 'success.main' : 
                                  analysis[category].score > 60 ? 'warning.main' : 'error.main'
                        }
                      }}
                    />
                  </Box>
                  
                  <List dense>
                    {analysis[category].details.map((detail, index) => (
                      <ListItem key={index}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {detail.toLowerCase().includes('vulnerability') || 
                           detail.toLowerCase().includes('risk') ||
                           detail.toLowerCase().includes('issue') ? 
                            <ErrorIcon color="error" /> : 
                            detail.toLowerCase().includes('ok') || 
                            detail.toLowerCase().includes('good') ? 
                              <CheckCircleIcon color="success" /> : 
                              <WarningIcon color="warning" />
                          }
                        </ListItemIcon>
                        <ListItemText primary={detail} />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              ))}
            </div>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Recommendations
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1">
                Based on this analysis, here are some recommendations for improving contract security:
              </Typography>
              <List>
                {analysis.vulnerabilities.details.map((vuln, index) => (
                  vuln.toLowerCase().includes('vulnerability') || 
                  vuln.toLowerCase().includes('risk') ||
                  vuln.toLowerCase().includes('issue') ? (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <WarningIcon color="warning" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={`Fix ${vuln.split(':')[0]}`} 
                        secondary={vuln.includes(':') ? vuln.split(':')[1] : ''}
                      />
                    </ListItem>
                  ) : null
                ))}
                {analysis.overall_score < 70 && (
                  <ListItem>
                    <ListItemIcon>
                      <WarningIcon color="error" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Consider a professional audit" 
                      secondary="The contract has significant security concerns that warrant professional review."
                    />
                  </ListItem>
                )}
              </List>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                <Button 
                  variant="outlined" 
                  color="primary"
                  startIcon={<ContentPasteIcon />}
                  onClick={() => {
                    const reportText = `
                    # Smart Contract Audit Report
                    
                    ## Overall Score: ${analysis.overall_score}/100
                    
                    ## Complexity Analysis
                    - Risk Level: ${analysis.complexity.risk_level}
                    - Score: ${analysis.complexity.score}/100
                    ${analysis.complexity.details.map(detail => `- ${detail}`).join('\n')}
                    
                    ## Vulnerability Analysis
                    - Risk Level: ${analysis.vulnerabilities.risk_level}
                    - Score: ${analysis.vulnerabilities.score}/100
                    ${analysis.vulnerabilities.details.map(detail => `- ${detail}`).join('\n')}
                    
                    ## Upgradability Analysis
                    - Risk Level: ${analysis.upgradability.risk_level}
                    - Score: ${analysis.upgradability.score}/100
                    ${analysis.upgradability.details.map(detail => `- ${detail}`).join('\n')}
                    
                    ## Behavior Analysis
                    - Risk Level: ${analysis.behavior.risk_level}
                    - Score: ${analysis.behavior.score}/100
                    ${analysis.behavior.details.map(detail => `- ${detail}`).join('\n')}
                    `;
                    navigator.clipboard.writeText(reportText);
                  }}
                >
                  Copy Report
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => window.print()}
                >
                  Export as PDF
                </Button>
              </Box>
            </Box>
          </Paper>
        )}
      </div>
    </Box>
  );
};

export default AuditTab;