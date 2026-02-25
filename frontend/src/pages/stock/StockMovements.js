import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Alert } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { getStockMovements } from '../../services/api';
import { format } from 'date-fns';

const StockMovements = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [totalRows, setTotalRows] = useState(0);

  useEffect(() => {
    fetchMovements();
  }, [paginationModel]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const response = await getStockMovements({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
      });
      setMovements(response.data.movements || []);
      setTotalRows(response.data.pagination?.total || 0);
    } catch (err) {
      setError('Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: 'movement_date', headerName: 'Date', width: 150,
      valueFormatter: (params) => format(new Date(params.value), 'dd/MM/yyyy HH:mm') },
    { field: 'product_name', headerName: 'Product', flex: 1, minWidth: 200 },
    { field: 'movement_type', headerName: 'Type', width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color={params.value === 'in' ? 'success' : 'error'} size="small" />
      )},
    { field: 'quantity', headerName: 'Quantity', width: 100 },
    { field: 'reference', headerName: 'Reference', width: 150 },
    { field: 'notes', headerName: 'Notes', flex: 1, minWidth: 200 },
  ];

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={3}>Stock Movements</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={movements}
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

export default StockMovements;
