import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Grid as MuiGrid, 
  Typography, 
  CircularProgress,
  Paper,
  InputAdornment,
  Slider,
  Divider,
  Tooltip,
  IconButton,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import SecurityIcon from '@mui/icons-material/Security';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ReactMarkdown from 'react-markdown';
import { assessInsurance } from '../../services/AIService';

// Create a typed Grid component to avoid the TypeScript errors
const Grid = (props: any) => <MuiGrid {...props} />;

// Define interface for insurance assessment results
interface InsuranceAssessmentResult {
  risk_score: number;
  premium_percentage: number;
  coverage_limit: string;
  risk_factors: string[];
  risk_level: 'Low' | 'Medium' | 'High';
  policy_recommendations: string[];
  exclusions: string[];
}

const marks = [
  { value: 10000, label: '$10K' },
  { value: 100000, label: '$100K' },
  { value: 1000000, label: '$1M' },
  { value: 10000000, label: '$10M' },
];

const InsuranceTab = () => {
  const [loading, setLoading] = useState(false);
  const [contractCode, setContractCode] = useState('');
  const [tvl, setTvl] = useState(1000000);
  const [result, setResult] = useState<InsuranceAssessmentResult | string | null>(null);
  const [error, setError] = useState('');

  const handleAssess = async () => {
    if (!contractCode) return;
    
    setLoading(true);
    setError('');
    setResult(null); // Clear previous results
    
    try {
      const assessmentResult = await assessInsurance(contractCode, tvl);
      console.log("Assessment result:", assessmentResult); // For debugging
      if (!assessmentResult) {
        throw new Error('Empty response received');
      }
      setResult(assessmentResult);
    } catch (err) {
      console.error("Error during assessment:", err);
      setError('Failed to assess insurance risk. Please try again.');
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

  // Type guard to check if result is InsuranceAssessmentResult object
  const isInsuranceResult = (result: any): result is InsuranceAssessmentResult => {
    return result && 
           typeof result === 'object' && 
           'risk_score' in result && 
           'risk_level' in result;
  };

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
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
              placeholder="Paste your smart contract code here..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CodeIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Insurance Parameters
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>What is TVL?</AlertTitle>
              Total Value Locked (TVL) represents the total amount of assets secured by your smart contract. 
              Higher TVL generally means more risk exposure and impacts insurance premium calculations.
            </Alert>
            <Box sx={{ px: 2, pt: 3 }}>
              <Typography gutterBottom>Total Value Locked (TVL)</Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item>
                  <AttachMoneyIcon />
                </Grid>
                <Grid item xs>
                  <Slider
                    value={tvl}
                    onChange={(_, newValue) => setTvl(newValue as number)}
                    min={10000}
                    max={10000000}
                    step={10000}
                    marks={marks}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `$${value.toLocaleString()}`}
                  />
                </Grid>
                <Grid item>
                  <Typography>
                    ${tvl.toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
            <Button
              variant="contained"
              color="primary"
              onClick={handleAssess}
              disabled={loading || !contractCode}
              startIcon={<SecurityIcon />}
              sx={{ mt: 3 }}
              fullWidth
            >
              {loading ? <CircularProgress size={24} /> : 'Assess Insurance Risk'}
            </Button>
          </Paper>
        </Grid>

        {error && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, bgcolor: 'error.dark' }}>
              <Typography color="error">{error}</Typography>
            </Paper>
          </Grid>
        )}

        {result && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Insurance Assessment
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ mt: 2 }}>
                {typeof result === 'string' ? (
                  <ReactMarkdown>
                    {result}
                  </ReactMarkdown>
                ) : isInsuranceResult(result) ? (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                      <Box>
                        <Typography variant="h5" gutterBottom>Risk Score: {result.risk_score}/100</Typography>
                        <Typography variant="body1" color={
                          result.risk_level === 'Low' ? 'success.main' :
                          result.risk_level === 'Medium' ? 'warning.main' : 'error.main'
                        }>
                          Risk Level: {result.risk_level}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="h5" gutterBottom>Premium: {result.premium_percentage}%</Typography>
                        <Typography variant="body1">
                          Coverage Limit: {result.coverage_limit}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Risk Factors</Typography>
                    <List>
                      {result.risk_factors && result.risk_factors.map((factor: string, index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            {factor.toLowerCase().includes('high-risk') ? (
                              <ErrorIcon color="error" />
                            ) : factor.toLowerCase().includes('medium-risk') ? (
                              <WarningIcon color="warning" />
                            ) : (
                              <CheckCircleIcon color="success" />
                            )}
                          </ListItemIcon>
                          <ListItemText primary={factor} />
                        </ListItem>
                      ))}
                    </List>
                    
                    <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Policy Recommendations</Typography>
                    <List>
                      {result.policy_recommendations && result.policy_recommendations.map((rec: string, index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <InfoIcon color="info" />
                          </ListItemIcon>
                          <ListItemText primary={rec} />
                        </ListItem>
                      ))}
                    </List>
                    
                    <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Exclusions</Typography>
                    <List>
                      {result.exclusions && result.exclusions.map((exclusion: string, index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <WarningIcon color="warning" />
                          </ListItemIcon>
                          <ListItemText primary={exclusion} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ) : (
                  <Typography color="error">Invalid result format received</Typography>
                )}
              </Box>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                <Button 
                  variant="outlined" 
                  color="primary"
                  startIcon={<ContentPasteIcon />}
                  onClick={() => {
                    let textToExport = '';
                    if (typeof result === 'string') {
                      textToExport = result;
                    } else if (isInsuranceResult(result)) {
                      textToExport = `# Insurance Assessment Report\n\n## Risk Assessment\n- Risk Score: ${result.risk_score}/100\n- Risk Level: ${result.risk_level}\n- Premium: ${result.premium_percentage}%\n- Coverage Limit: ${result.coverage_limit}\n\n## Risk Factors\n${result.risk_factors.map(factor => `- ${factor}`).join('\n')}\n\n## Policy Recommendations\n${result.policy_recommendations.map(rec => `- ${rec}`).join('\n')}\n\n## Exclusions\n${result.exclusions.map(ex => `- ${ex}`).join('\n')}`;
                    }
                    navigator.clipboard.writeText(textToExport);
                  }}
                >
                  Copy Results
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => window.print()}
                >
                  Export as PDF
                </Button>
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default InsuranceTab;