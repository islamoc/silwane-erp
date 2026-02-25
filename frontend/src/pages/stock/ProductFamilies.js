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
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, Refresh } from '@mui/icons-material';
import {
  getProductFamilies,
  createProductFamily,
  updateProductFamily,
  deleteProductFamily,
} from '../../services/api';

const ProductFamilies = () => {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentFamily, setCurrentFamily] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10,
  });
  const [totalRows, setTotalRows] = useState(0);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchFamilies();
  }, [paginationModel]);

  const fetchFamilies = async () => {
    try {
      setLoading(true);
      const response = await getProductFamilies({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
      });
      setFamilies(response.data.families || []);
      setTotalRows(response.data.pagination?.total || 0);
    } catch (err) {
      setError('Failed to load product families');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (family = null) => {
    if (family) {
      setEditMode(true);
      setCurrentFamily(family);
      setFormData({
        code: family.code || '',
        name: family.name || '',
        description: family.description || '',
      });
    } else {
      setEditMode(false);
      setCurrentFamily(null);
      setFormData({
        code: '',
        name: '',
        description: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditMode(false);
    setCurrentFamily(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      if (editMode) {
        await updateProductFamily(currentFamily.id, formData);
        setSuccess('Product family updated successfully');
      } else {
        await createProductFamily(formData);
        setSuccess('Product family created successfully');
      }
      handleCloseDialog();
      fetchFamilies();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product family?')) {
      try {
        await deleteProductFamily(id);
        setSuccess('Product family deleted successfully');
        fetchFamilies();
      } catch (err) {
        setError('Failed to delete product family');
      }
    }
  };

  const columns = [
    { field: 'code', headerName: 'Code', width: 150 },
    { field: 'name', headerName: 'Family Name', flex: 1, minWidth: 250 },
    { field: 'description', headerName: 'Description', flex: 1, minWidth: 300 },
    {
      field: 'product_count',
      headerName: 'Products',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value || 0} color="primary" size="small" />
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
          Product Families
        </Typography>
        <Box>
          <Button
            startIcon={<Refresh />}
            onClick={fetchFamilies}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            Add Family
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
          rows={families}
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

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editMode ? 'Edit Product Family' : 'Add New Product Family'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Code"
              name="code"
              value={formData.code}
              onChange={handleChange}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Family Name"
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
              rows={4}
            />
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

export default ProductFamilies;
