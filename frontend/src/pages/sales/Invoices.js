import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import { getInvoices } from '../../services/api';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  useEffect(() => {
    fetchInvoices();
  }, [paginationModel]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await getInvoices({ page: paginationModel.page + 1, limit: paginationModel.pageSize });
      setInvoices(response.data.invoices || []);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: 'invoice_number', headerName: 'Invoice #', width: 150 },
    { field: 'customer_name', headerName: 'Customer', flex: 1 },
    { field: 'total_amount', headerName: 'Amount', width: 120 },
    { field: 'payment_status', headerName: 'Status', width: 120, renderCell: (params) => <Chip label={params.value} size="small" /> },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight="bold">Invoices</Typography>
        <Button variant="contained" startIcon={<Add />}>New Invoice</Button>
      </Box>
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid rows={invoices} columns={columns} loading={loading} paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel} sx={{ bgcolor: 'background.paper' }} />
      </Box>
    </Box>
  );
};

export default Invoices;
