import React from 'react';
import { Box, Typography, Paper, TextField, Button, Grid, Avatar } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

const Profile = () => {
  const { user } = useAuth();

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={3}>My Profile</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Avatar sx={{ width: 120, height: 120, margin: '0 auto', mb: 2, bgcolor: 'primary.main', fontSize: 48 }}>
              {user?.name?.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="h6">{user?.name}</Typography>
            <Typography color="text.secondary">{user?.role}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={3}>Personal Information</Typography>
            <TextField fullWidth label="Name" value={user?.name || ''} margin="normal" disabled />
            <TextField fullWidth label="Email" value={user?.email || ''} margin="normal" disabled />
            <TextField fullWidth label="Role" value={user?.role || ''} margin="normal" disabled />
            <Box mt={3}>
              <Button variant="contained">Update Profile</Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Profile;
