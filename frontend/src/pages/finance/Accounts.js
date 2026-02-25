import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import { getAccounts } from '../../services/api';

const Accounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await getAccounts();
      setAccounts(response.data.accounts || []);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: 'account_code', headerName: 'Code', width: 120 },
    { field: 'account_name', headerName: 'Account Name', flex: 1 },
    { field: 'account_type', headerName: 'Type', width: 150 },
    { field: 'balance', headerName: 'Balance', width: 150 },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight="bold">Chart of Accounts</Typography>
        <Button variant="contained" startIcon={<Add />}>Add Account</Button>
      </Box>
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid rows={accounts} columns={columns} loading={loading} sx={{ bgcolor: 'background.paper' }} />
      </Box>
    </Box>
  );
};

export default Accounts;
