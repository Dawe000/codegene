import React from 'react';
import { Button, Box, Chip, Tooltip } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useWeb3 } from './Web3Context';

const shortenAddress = (address: string) => {
  return address.slice(0, 6) + '...' + address.slice(-4);
};

const SimpleWalletConnect: React.FC = () => {
  const { account, chainId, connect, disconnect, isActive, balance, isConnecting, getChainName } = useWeb3();

  return (
    <>
      {isActive && account ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Network Chip */}
          <Tooltip title={`Connected to ${getChainName(chainId || 1)}`}>
            <Chip
              size="small"
              label={getChainName(chainId || 1)}
              color="primary"
              variant="outlined"
            />
          </Tooltip>
          
          {/* Balance Chip */}
          <Tooltip title={`Balance: ${balance} ETH`}>
            <Chip
              size="small"
              label={`${parseFloat(balance).toFixed(4)} ETH`}
              color="success"
              variant="outlined"
            />
          </Tooltip>
          
          {/* Address Chip - Clicking disconnects */}
          <Tooltip title="Click to disconnect">
            <Chip
              label={shortenAddress(account)}
              color="secondary"
              variant="outlined"
              onClick={disconnect}
              sx={{ cursor: 'pointer' }}
            />
          </Tooltip>
        </Box>
      ) : (
        <Button
          variant="contained"
          color="primary"
          startIcon={<AccountBalanceWalletIcon />}
          onClick={connect}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </Button>
      )}
    </>
  );
};

export default SimpleWalletConnect;