import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  CircularProgress,
  Paper,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  FormHelperText,
  IconButton,
  Tooltip,
  Alert,
  AlertTitle,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import TranslateIcon from '@mui/icons-material/Translate';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { translateContract } from '../../services/AIService';
import { getContractSource } from '../../services/etherscanService';
import { getSolanaProgram } from '../../services/solscanService'; 

// Define a proper interface for the language info structure
interface LanguageContent {
  title: string;
  content: string[];
}

// Define the type for our languageInfo object with explicit index signature
interface LanguageInfoMap {
  [key: string]: LanguageContent;
}

const languages = [
  { value: 'solidity', label: 'Solidity (Ethereum)' },
  { value: 'rust', label: 'Rust (Solana)' },
  { value: 'vyper', label: 'Vyper (Ethereum)' },
  { value: 'haskell', label: 'Haskell (Cardano)' }
];

// Now create the languageInfo object with the proper type
const languageInfo: LanguageInfoMap = {
  rust: {
    title: "Rust for Solana",
    content: [
      "Solana programs require Anchor framework dependencies for development",
      "Install Solana CLI tools and Rust before developing",
      "Build with: `cargo build-bpf`",
      "Deploy with: `solana program deploy target/deploy/program.so`",
      "Account management is explicit - each account must be passed to the program",
      "State is stored in separate account structures rather than within the contract"
    ]
  },
  vyper: {
    title: "Vyper for Ethereum",
    content: [
      "Vyper requires Python 3.6+ and vyper compiler (`pip install vyper`)",
      "Compile with: `vyper contract.vy`",
      "Vyper is intentionally less feature-rich than Solidity for security reasons",
      "No inheritance, recursive calling, or infinite loops",
      "Designed to make contracts more auditable and secure",
      "Deploy using web3.py or other Ethereum development tools"
    ]
  },
  haskell: {
    title: "Haskell for Cardano",
    content: [
      "Cardano smart contracts use Plutus, a Haskell-based DSL",
      "Requires Cardano development environment (cardano-node, cardano-cli)",
      "Install Plutus dependencies using Nix or Docker",
      "Build with Cabal: `cabal build`",
      "Cardano uses UTXO model rather than account model",
      "Validator scripts validate transactions rather than mutating state",
      "Testing requires Plutus Playground or local testnet"
    ]
  },
  solidity: {
    title: "Solidity for Ethereum",
    content: [
      "Compile with Solidity compiler (solc) or frameworks like Hardhat/Truffle",
      "Deploy using web3.js, ethers.js, or other Ethereum libraries",
      "EVM compatible with multiple chains (Ethereum, Polygon, BSC, etc.)",
      "Gas costs vary based on operations performed",
      "Consider security best practices from OpenZeppelin",
      "Test thoroughly before deployment using frameworks like Waffle or Hardhat"
    ]
  }
};

const TranslateTab = () => {
  const [loading, setLoading] = useState(false);
  const [sourceCode, setSourceCode] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('solidity');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [explorerType, setExplorerType] = useState('etherscan');

  const handleTranslate = async () => {
    if (!sourceCode || !targetLanguage) return;
    
    setLoading(true);
    setError('');
    
    try {
      const translationResult = await translateContract(sourceCode, targetLanguage);
      setResult(translationResult);
    } catch (err) {
      setError(`Failed to translate contract to ${targetLanguage}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setSourceCode(clipboardText);
    } catch (err) {
      setError("Failed to access clipboard. Please paste manually.");
    }
  };

  const handleFetchContract = async () => {
    if (!contractAddress) return;
    
    setLoading(true);
    setError('');
    
    try {
      let fetchedCode: string = '';
      
      if (explorerType === 'etherscan') {
        const etherscanCode = await getContractSource(contractAddress);
        if (etherscanCode) {
          fetchedCode = etherscanCode;
          setSourceLanguage('solidity'); // Default source language for Etherscan
        }
      } else if (explorerType === 'solscan') {
        const solanaCode = await getSolanaProgram(contractAddress);
        if (solanaCode) {
          fetchedCode = solanaCode;
          setSourceLanguage('rust'); // Default source language for Solscan
        }
      }
      
      // Only set the source code if we got something back
      if (fetchedCode) {
        setSourceCode(fetchedCode);
      } else {
        throw new Error('No source code returned');
      }
    } catch (err) {
      setError(`Failed to fetch contract source code from ${explorerType}. Please check the address and try again.`);
    } finally {
      setLoading(false);
    }
  };
  

  const handleExplorerChange = (event: React.MouseEvent<HTMLElement>, newExplorer: string) => {
    if (newExplorer !== null) {
      setExplorerType(newExplorer);
      setContractAddress(''); // Clear the address when switching explorers
      
      // Set appropriate default source language based on explorer
      if (newExplorer === 'etherscan') {
        setSourceLanguage('solidity');
      } else if (newExplorer === 'solscan') {
        setSourceLanguage('rust');
      }
      
      // Clear target language when switching explorer
      setTargetLanguage('');
    }
  };
  
  // Get available target languages based on source language and explorer type
  const getAvailableTargetLanguages = () => {
    // Different exclusion logic based on explorer type
    if (explorerType === 'etherscan') {
      // For Etherscan: exclude solidity
      return languages.filter(lang => lang.value !== 'solidity');
    } else {
      // For Solscan: exclude rust
      return languages.filter(lang => lang.value !== 'rust');
    }
  };

  return (
    <Box>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Fetch Contract from Blockchain
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <ToggleButtonGroup
              color="primary"
              value={explorerType}
              exclusive
              onChange={handleExplorerChange}
              aria-label="Blockchain Explorer"
              fullWidth
            >
              <ToggleButton value="etherscan">Etherscan (Ethereum)</ToggleButton>
              <ToggleButton value="solscan">Solscan (Solana)</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              fullWidth
              label={explorerType === 'etherscan' ? "Contract Address" : "Program ID"}
              variant="outlined"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder={explorerType === 'etherscan' ? "0x..." : "Program ID..."}
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
              onClick={handleFetchContract}
              disabled={loading || !contractAddress}
              sx={{ ml: 2, height: '56px' }}
            >
              {loading ? <CircularProgress size={24} /> : 'Fetch'}
            </Button>
          </Box>
          
          {explorerType === 'solscan' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <AlertTitle>Note on Solana Programs</AlertTitle>
              Solana programs are often closed-source or only available in compiled form. The fetch may return bytecode or a limited view of the program.
            </Alert>
          )}
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
                 Source Code ({sourceLanguage.charAt(0).toUpperCase() + sourceLanguage.slice(1)})
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
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
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

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Translation Settings
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Target Language</InputLabel>
              <Select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                label="Target Language"
              >
                {getAvailableTargetLanguages().map((lang) => (
                  <MenuItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Select the blockchain language to translate to</FormHelperText>
            </FormControl>
            
            {targetLanguage && languageInfo[targetLanguage] && (
              <Alert 
                severity="info" 
                icon={<InfoIcon />}
                sx={{ mt: 2 }}
              >
                <AlertTitle>{languageInfo[targetLanguage]?.title || targetLanguage.toUpperCase()}</AlertTitle>
                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                  {languageInfo[targetLanguage]?.content.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </Box>
              </Alert>
            )}
            
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleTranslate}
              disabled={loading || !sourceCode || !targetLanguage}
              startIcon={<TranslateIcon />}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Translate'}
            </Button>
          </Box>
        </Paper>

        {error && (
          <Paper sx={{ p: 3, bgcolor: 'error.dark' }}>
            <Typography color="error">{error}</Typography>
          </Paper>
        )}

        {result && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Translated Code ({targetLanguage})
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {targetLanguage && languageInfo[targetLanguage] && (
              <Alert 
                severity="info" 
                icon={<InfoIcon />}
                sx={{ mb: 2 }}
              >
                <AlertTitle>Setup & Deployment</AlertTitle>
                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                  {languageInfo[targetLanguage]?.content.slice(0, 2).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </Box>
              </Alert>
            )}
            
            <SyntaxHighlighter 
              language={targetLanguage === 'haskell' ? 'haskell' : 
                       targetLanguage === 'rust' ? 'rust' : 
                       targetLanguage === 'vyper' ? 'python' : 'javascript'}
              style={atomDark}
              showLineNumbers
              customStyle={{ borderRadius: '4px' }}
            >
              {result}
            </SyntaxHighlighter>
            <Button 
              variant="outlined" 
              color="primary" 
              startIcon={<ContentPasteIcon />}
              onClick={() => navigator.clipboard.writeText(result)}
              sx={{ mt: 2 }}
            >
              Copy to Clipboard
            </Button>
          </Paper>
        )}
      </div>
    </Box>
  );
};

export default TranslateTab;