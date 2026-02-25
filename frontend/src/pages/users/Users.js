import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import { getUsers } from '../../services/api';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await getUsers();
      setUsers(response.data.users || []);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'email', headerName: 'Email', flex: 1 },
    { field: 'role', headerName: 'Role', width: 150, renderCell: (params) => <Chip label={params.value} size="small" /> },
    { field: 'status', headerName: 'Status', width: 120, renderCell: (params) => <Chip label={params.value} color={params.value === 'active' ? 'success' : 'default'} size="small" /> },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight="bold">User Management</Typography>
        <Button variant="contained" startIcon={<Add />}>Add User</Button>
      </Box>
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid rows={users} columns={columns} loading={loading} sx={{ bgcolor: 'background.paper' }} />
      </Box>
    </Box>
  );
};

export default Users;
