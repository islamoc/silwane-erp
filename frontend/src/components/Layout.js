import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Collapse,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  PointOfSale as PointOfSaleIcon,
  AccountBalance as AccountBalanceIcon,
  Analytics as AnalyticsIcon,
  BarChart as BarChartIcon,
  People as PeopleIcon,
  ExpandLess,
  ExpandMore,
  ChevronLeft,
  Logout,
  Person,
  Business,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 280;

const Layout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openMenus, setOpenMenus] = useState({});

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (menu) => {
    setOpenMenus((prev) => ({ ...prev, [menu]: !prev[menu] }));
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const menuItems = [
    {
      title: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
    },
    {
      title: 'Stock Management',
      icon: <InventoryIcon />,
      submenu: [
        { title: 'Products', path: '/stock/products' },
        { title: 'Product Families', path: '/stock/families' },
        { title: 'Stock Movements', path: '/stock/movements' },
        { title: 'Traceability', path: '/stock/traceability' },
      ],
    },
    {
      title: 'Purchase',
      icon: <ShoppingCartIcon />,
      submenu: [
        { title: 'Purchase Orders', path: '/purchase/orders' },
        { title: 'Suppliers', path: '/purchase/suppliers' },
      ],
    },
    {
      title: 'Sales',
      icon: <PointOfSaleIcon />,
      submenu: [
        { title: 'Quotes', path: '/sales/quotes' },
        { title: 'Orders', path: '/sales/orders' },
        { title: 'Invoices', path: '/sales/invoices' },
        { title: 'Customers', path: '/sales/customers' },
      ],
    },
    {
      title: 'Finance',
      icon: <AccountBalanceIcon />,
      submenu: [
        { title: 'Transactions', path: '/finance/transactions' },
        { title: 'Bank Reconciliation', path: '/finance/reconciliation' },
        { title: 'Cash Flow', path: '/finance/cashflow' },
        { title: 'Accounts', path: '/finance/accounts' },
      ],
    },
    {
      title: 'Analytics',
      icon: <AnalyticsIcon />,
      submenu: [
        { title: 'VAT Declaration', path: '/analytics/vat' },
        { title: 'Balance Sheet', path: '/analytics/balance' },
      ],
    },
    {
      title: 'Statistics',
      icon: <BarChartIcon />,
      path: '/statistics',
    },
    {
      title: 'Users',
      icon: <PeopleIcon />,
      path: '/users',
      requiredRole: 'admin',
    },
  ];

  const drawer = (
    <Box>
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 2,
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Business color="primary" />
          <Box>
            <Typography variant="h6" noWrap fontWeight="bold">
              Silwane ERP
            </Typography>
            <Typography variant="caption" color="text.secondary">
              GK PRO STONES
            </Typography>
          </Box>
        </Box>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle}>
            <ChevronLeft />
          </IconButton>
        )}
      </Toolbar>
      <Divider />
      <List sx={{ px: 1, py: 2 }}>
        {menuItems.map((item) => {
          if (item.requiredRole && user?.role !== 'super_admin' && user?.role !== 'admin') {
            return null;
          }

          if (item.submenu) {
            return (
              <React.Fragment key={item.title}>
                <ListItemButton
                  onClick={() => handleMenuClick(item.title)}
                  sx={{ borderRadius: 2, mb: 0.5 }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.title} />
                  {openMenus[item.title] ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={openMenus[item.title]} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.submenu.map((subItem) => (
                      <ListItemButton
                        key={subItem.path}
                        onClick={() => handleNavigation(subItem.path)}
                        selected={location.pathname === subItem.path}
                        sx={{
                          pl: 4,
                          borderRadius: 2,
                          mb: 0.5,
                          '&.Mui-selected': {
                            backgroundColor: theme.palette.primary.main,
                            color: 'white',
                            '&:hover': {
                              backgroundColor: theme.palette.primary.dark,
                            },
                          },
                        }}
                      >
                        <ListItemText primary={subItem.title} />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </React.Fragment>
            );
          }

          return (
            <ListItem key={item.title} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={location.pathname === item.path}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.main,
                    color: 'white',
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.primary.dark,
                    },
                  },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.title} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          backgroundColor: 'white',
          color: 'text.primary',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {/* Page title can be dynamic based on location */}
          </Typography>
          <IconButton onClick={handleProfileMenuOpen}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
      >
        <MenuItem onClick={() => handleNavigation('/profile')}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
