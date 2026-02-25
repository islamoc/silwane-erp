import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import { getTransactions } from '../../services/api';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  useEffect(() => {
    fetchTransactions();
  }, [paginationModel]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await getTransactions({ page: paginationModel.page + 1, limit: paginationModel.pageSize });
      setTransactions(response.data.transactions || []);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: 'transaction_date', headerName: 'Date', width: 120 },
    { field: 'type', headerName: 'Type', width: 120, renderCell: (params) => <Chip label={params.value} size="small" /> },
    { field: 'amount', headerName: 'Amount', width: 120 },
    { field: 'description', headerName: 'Description', flex: 1 },
    { field: 'status', headerName: 'Status', width: 120, renderCell: (params) => <Chip label={params.value} size="small" /> },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight="bold">Transactions</Typography>
        <Button variant="contained" startIcon={<Add />}>New Transaction</Button>
      </Box>
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid rows={transactions} columns={columns} loading={loading} paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel} sx={{ bgcolor: 'background.paper' }} />
      </Box>
    </Box>
  );
};

export default Transactions;
