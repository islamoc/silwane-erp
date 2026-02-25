import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Alert, Button } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Refresh } from '@mui/icons-material';
import { getSuppliers } from '../../services/api';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [totalRows, setTotalRows] = useState(0);

  useEffect(() => {
    fetchSuppliers();
  }, [paginationModel]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await getSuppliers({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
      });
      setSuppliers(response.data.suppliers || []);
      setTotalRows(response.data.pagination?.total || 0);
    } catch (err) {
      setError('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: 'supplier_code', headerName: 'Code', width: 120 },
    { field: 'name', headerName: 'Supplier Name', flex: 1, minWidth: 200 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'phone', headerName: 'Phone', width: 150 },
    { field: 'city', headerName: 'City', width: 150 },
    { field: 'status', headerName: 'Status', width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color={params.value === 'active' ? 'success' : 'default'} size="small" />
      )},
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight="bold">Suppliers</Typography>
        <Box>
          <Button startIcon={<Refresh />} onClick={fetchSuppliers} sx={{ mr: 1 }}>Refresh</Button>
          <Button variant="contained" startIcon={<Add />}>Add Supplier</Button>
        </Box>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={suppliers}
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

export default Suppliers;
