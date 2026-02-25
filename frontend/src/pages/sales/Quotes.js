import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import { getQuotes } from '../../services/api';

const Quotes = () => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  useEffect(() => {
    fetchQuotes();
  }, [paginationModel]);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const response = await getQuotes({ page: paginationModel.page + 1, limit: paginationModel.pageSize });
      setQuotes(response.data.quotes || []);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: 'quote_number', headerName: 'Quote #', width: 150 },
    { field: 'customer_name', headerName: 'Customer', flex: 1 },
    { field: 'total_amount', headerName: 'Amount', width: 120 },
    { field: 'status', headerName: 'Status', width: 120, renderCell: (params) => <Chip label={params.value} size="small" /> },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight="bold">Quotes</Typography>
        <Button variant="contained" startIcon={<Add />}>New Quote</Button>
      </Box>
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid rows={quotes} columns={columns} loading={loading} paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel} sx={{ bgcolor: 'background.paper' }} />
      </Box>
    </Box>
  );
};

export default Quotes;
