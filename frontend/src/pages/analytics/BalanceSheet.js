import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, CircularProgress } from '@mui/material';
import { getBalanceSheet } from '../../services/api';

const BalanceSheet = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await getBalanceSheet();
      setData(response.data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={3}>Balance Sheet</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>Assets</Typography>
            <Typography>Total Assets: {data?.total_assets || 0} DZD</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>Liabilities</Typography>
            <Typography>Total Liabilities: {data?.total_liabilities || 0} DZD</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BalanceSheet;
