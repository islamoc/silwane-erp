import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, CircularProgress } from '@mui/material';
import { getVATDeclaration } from '../../services/api';

const VATDeclaration = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await getVATDeclaration();
      setData(response.data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={3}>VAT Declaration</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6">VAT Collected</Typography>
            <Typography variant="h4">{data?.collected || 0} DZD</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6">VAT Deductible</Typography>
            <Typography variant="h4">{data?.deductible || 0} DZD</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default VATDeclaration;
