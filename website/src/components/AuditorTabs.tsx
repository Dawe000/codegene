import React, { useState } from 'react';
import { Box, Tab, Tabs, Paper } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import TranslateIcon from '@mui/icons-material/Translate';
import SecurityIcon from '@mui/icons-material/Security';
import AuditTab from './tabs/AuditTab';
import TranslateTab from '././tabs/TranslateTab';
import InsuranceTab from './tabs/InsuranceTab';
import SubscriptionTab from './tabs/subscribstionTab';
import ZoraCoinsTab from './tabs/ZoraCoinsTab';
//import InsuranceTab from './tabs/InsuranceTab';
//import SubscriptionTab from './tabs/subscribstionTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`auditor-tabpanel-${index}`}
      aria-labelledby={`auditor-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `auditor-tab-${index}`,
    'aria-controls': `auditor-tabpanel-${index}`,
  };
}

const AuditorTabs = () => {
  const [value, setValue] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Paper sx={{ borderRadius: 2 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={value} 
          onChange={handleChange} 
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab icon={<TranslateIcon />} label="TRANSLATE" {...a11yProps(0)} />
          <Tab icon={<SecurityIcon />} label="AUDIT" {...a11yProps(1)} />
          <Tab icon={<CodeIcon />} label="INSURANCE" {...a11yProps(2)} />
          <Tab icon={<SecurityIcon />} label="SUBSCRIPTION" {...a11yProps(3)} />
          <Tab icon={<SecurityIcon />} label="ZORA COINS" {...a11yProps(4)} />
        </Tabs>
      </Box>
      
      <TabPanel value={value} index={0}>
        <TranslateTab />
      </TabPanel>

      <TabPanel value={value} index={1}>
        <AuditTab />
      </TabPanel>

      <TabPanel value={value} index={3}>
        <SubscriptionTab />
      </TabPanel>

      <TabPanel value={value} index={4}>
        <ZoraCoinsTab />
      </TabPanel>
       
      <TabPanel value={value} index={2}>
        <InsuranceTab />
      </TabPanel>
    </Paper>
  );
};

export default AuditorTabs;