import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, Alert } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Search } from '@mui/icons-material';
import { getStockTraceability } from '../../services/api';
import { format } from 'date-fns';

const StockTraceability = () => {
  const [productId, setProductId] = useState('');
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!productId) return;
    try {
      setLoading(true);
      const response = await getStockTraceability(productId);
      setMovements(response.data.movements || []);
    } catch (err) {
      setError('Failed to load traceability data');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: 'movement_date', headerName: 'Date', width: 150,
      valueFormatter: (params) => format(new Date(params.value), 'dd/MM/yyyy HH:mm') },
    { field: 'movement_type', headerName: 'Type', width: 100 },
    { field: 'quantity', headerName: 'Quantity', width: 100 },
    { field: 'reference', headerName: 'Reference', width: 150 },
    { field: 'user_name', headerName: 'User', width: 150 },
    { field: 'notes', headerName: 'Notes', flex: 1 },
  ];

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={3}>Stock Traceability</Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" gap={2}>
          <TextField
            label="Product ID"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={handleSearch} startIcon={<Search />}>
            Search
          </Button>
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={movements}
          columns={columns}
          loading={loading}
          sx={{ bgcolor: 'background.paper' }}
        />
      </Box>
    </Box>
  );
};

export default StockTraceability;
