import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  IconButton,
  Chip,
  Alert,
  MenuItem,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, Refresh } from '@mui/icons-material';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductFamilies,
} from '../../services/api';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10,
  });
  const [totalRows, setTotalRows] = useState(0);

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    unit_price: '',
    cost_price: '',
    stock_quantity: '',
    min_stock_level: '',
    max_stock_level: '',
    unit: '',
    family_id: '',
    status: 'active',
  });

  useEffect(() => {
    fetchProducts();
    fetchFamilies();
  }, [paginationModel]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await getProducts({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
      });
      setProducts(response.data.products || []);
      setTotalRows(response.data.pagination?.total || 0);
    } catch (err) {
      setError('Failed to load products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFamilies = async () => {
    try {
      const response = await getProductFamilies({ page: 1, limit: 100 });
      setFamilies(response.data.families || []);
    } catch (err) {
      console.error('Failed to load families:', err);
    }
  };

  const handleOpenDialog = (product = null) => {
    if (product) {
      setEditMode(true);
      setCurrentProduct(product);
      setFormData({
        sku: product.sku || '',
        name: product.name || '',
        description: product.description || '',
        unit_price: product.unit_price || '',
        cost_price: product.cost_price || '',
        stock_quantity: product.stock_quantity || '',
        min_stock_level: product.min_stock_level || '',
        max_stock_level: product.max_stock_level || '',
        unit: product.unit || '',
        family_id: product.family_id || '',
        status: product.status || 'active',
      });
    } else {
      setEditMode(false);
      setCurrentProduct(null);
      setFormData({
        sku: '',
        name: '',
        description: '',
        unit_price: '',
        cost_price: '',
        stock_quantity: '',
        min_stock_level: '',
        max_stock_level: '',
        unit: '',
        family_id: '',
        status: 'active',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditMode(false);
    setCurrentProduct(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      if (editMode) {
        await updateProduct(currentProduct.id, formData);
        setSuccess('Product updated successfully');
      } else {
        await createProduct(formData);
        setSuccess('Product created successfully');
      }
      handleCloseDialog();
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
        setSuccess('Product deleted successfully');
        fetchProducts();
      } catch (err) {
        setError('Failed to delete product');
      }
    }
  };

  const columns = [
    { field: 'sku', headerName: 'SKU', width: 120 },
    { field: 'name', headerName: 'Product Name', flex: 1, minWidth: 200 },
    {
      field: 'unit_price',
      headerName: 'Price',
      width: 120,
      valueFormatter: (params) =>
        new Intl.NumberFormat('fr-DZ', {
          style: 'currency',
          currency: 'DZD',
        }).format(params.value),
    },
    {
      field: 'stock_quantity',
      headerName: 'Stock',
      width: 100,
      renderCell: (params) => {
        const isLow =
          params.row.min_stock_level &&
          params.value <= params.row.min_stock_level;
        return (
          <Chip
            label={params.value}
            color={isLow ? 'error' : 'success'}
            size="small"
          />
        );
      },
    },
    { field: 'unit', headerName: 'Unit', width: 80 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={params.value === 'active' ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => handleOpenDialog(params.row)}
            color="primary"
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.id)}
            color="error"
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" fontWeight="bold">
          Products
        </Typography>
        <Box>
          <Button
            startIcon={<Refresh />}
            onClick={fetchProducts}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            Add Product
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={products}
          columns={columns}
          loading={loading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]}
          rowCount={totalRows}
          paginationMode="server"
          sx={{ bgcolor: 'background.paper' }}
        />
      </Box>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editMode ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="SKU"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Product Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              margin="normal"
              multiline
              rows={3}
            />
            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                label="Unit Price (DZD)"
                name="unit_price"
                type="number"
                value={formData.unit_price}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Cost Price (DZD)"
                name="cost_price"
                type="number"
                value={formData.cost_price}
                onChange={handleChange}
                margin="normal"
              />
            </Box>
            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                label="Stock Quantity"
                name="stock_quantity"
                type="number"
                value={formData.stock_quantity}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Unit"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                margin="normal"
                placeholder="e.g., pcs, kg, m"
              />
            </Box>
            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                label="Min Stock Level"
                name="min_stock_level"
                type="number"
                value={formData.min_stock_level}
                onChange={handleChange}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Max Stock Level"
                name="max_stock_level"
                type="number"
                value={formData.max_stock_level}
                onChange={handleChange}
                margin="normal"
              />
            </Box>
            <TextField
              fullWidth
              select
              label="Product Family"
              name="family_id"
              value={formData.family_id}
              onChange={handleChange}
              margin="normal"
            >
              <MenuItem value="">None</MenuItem>
              {families.map((family) => (
                <MenuItem key={family.id} value={family.id}>
                  {family.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              select
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              margin="normal"
              required
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="discontinued">Discontinued</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Products;
