import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import { getCustomers } from '../../services/api';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  useEffect(() => {
    fetchCustomers();
  }, [paginationModel]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await getCustomers({ page: paginationModel.page + 1, limit: paginationModel.pageSize });
      setCustomers(response.data.customers || []);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: 'customer_code', headerName: 'Code', width: 120 },
    { field: 'name', headerName: 'Customer Name', flex: 1 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'phone', headerName: 'Phone', width: 150 },
    { field: 'status', headerName: 'Status', width: 120, renderCell: (params) => <Chip label={params.value} size="small" /> },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight="bold">Customers</Typography>
        <Button variant="contained" startIcon={<Add />}>Add Customer</Button>
      </Box>
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid rows={customers} columns={columns} loading={loading} paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel} sx={{ bgcolor: 'background.paper' }} />
      </Box>
    </Box>
  );
};

export default Customers;
