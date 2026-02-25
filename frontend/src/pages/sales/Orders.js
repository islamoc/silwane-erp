import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import { getOrders } from '../../services/api';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  useEffect(() => {
    fetchOrders();
  }, [paginationModel]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await getOrders({ page: paginationModel.page + 1, limit: paginationModel.pageSize });
      setOrders(response.data.orders || []);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: 'order_number', headerName: 'Order #', width: 150 },
    { field: 'customer_name', headerName: 'Customer', flex: 1 },
    { field: 'total_amount', headerName: 'Amount', width: 120 },
    { field: 'status', headerName: 'Status', width: 120, renderCell: (params) => <Chip label={params.value} size="small" /> },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight="bold">Customer Orders</Typography>
        <Button variant="contained" startIcon={<Add />}>New Order</Button>
      </Box>
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid rows={orders} columns={columns} loading={loading} paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel} sx={{ bgcolor: 'background.paper' }} />
      </Box>
    </Box>
  );
};

export default Orders;
