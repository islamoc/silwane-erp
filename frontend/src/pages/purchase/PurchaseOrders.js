import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Alert, Button } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Refresh } from '@mui/icons-material';
import { getPurchaseOrders } from '../../services/api';
import { format } from 'date-fns';

const PurchaseOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [totalRows, setTotalRows] = useState(0);

  useEffect(() => {
    fetchOrders();
  }, [paginationModel]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await getPurchaseOrders({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
      });
      setOrders(response.data.orders || []);
      setTotalRows(response.data.pagination?.total || 0);
    } catch (err) {
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: 'order_number', headerName: 'Order #', width: 150 },
    { field: 'supplier_name', headerName: 'Supplier', flex: 1, minWidth: 200 },
    { field: 'order_date', headerName: 'Date', width: 120,
      valueFormatter: (params) => format(new Date(params.value), 'dd/MM/yyyy') },
    { field: 'total_amount', headerName: 'Total', width: 120,
      valueFormatter: (params) => new Intl.NumberFormat('fr-DZ', {
        style: 'currency', currency: 'DZD'
      }).format(params.value) },
    { field: 'status', headerName: 'Status', width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color="primary" size="small" />
      )},
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight="bold">Purchase Orders</Typography>
        <Box>
          <Button startIcon={<Refresh />} onClick={fetchOrders} sx={{ mr: 1 }}>Refresh</Button>
          <Button variant="contained" startIcon={<Add />}>New Order</Button>
        </Box>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={orders}
          columns={columns}
          loading={loading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50]}
          rowCount={totalRows}
          paginationMode="server"
          sx={{ bgcolor: 'background.paper' }}
        />
      </Box>
    </Box>
  );
};

export default PurchaseOrders;
