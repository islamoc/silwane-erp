import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';

// Stock Management
import Products from './pages/stock/Products';
import ProductFamilies from './pages/stock/ProductFamilies';
import StockMovements from './pages/stock/StockMovements';
import StockTraceability from './pages/stock/StockTraceability';

// Purchase Management
import PurchaseOrders from './pages/purchase/PurchaseOrders';
import Suppliers from './pages/purchase/Suppliers';

// Sales Management
import Quotes from './pages/sales/Quotes';
import Orders from './pages/sales/Orders';
import Invoices from './pages/sales/Invoices';
import Customers from './pages/sales/Customers';

// Finance
import Transactions from './pages/finance/Transactions';
import BankReconciliation from './pages/finance/BankReconciliation';
import CashFlow from './pages/finance/CashFlow';
import Accounts from './pages/finance/Accounts';

// Analytics
import VATDeclaration from './pages/analytics/VATDeclaration';
import BalanceSheet from './pages/analytics/BalanceSheet';

// Statistics
import Statistics from './pages/statistics/Statistics';

// Users
import Users from './pages/users/Users';
import Profile from './pages/users/Profile';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#e33371',
      dark: '#9a0036',
    },
    success: {
      main: '#4caf50',
    },
    warning: {
      main: '#ff9800',
    },
    error: {
      main: '#f44336',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      
                      {/* Stock Management */}
                      <Route path="/stock/products" element={<Products />} />
                      <Route path="/stock/families" element={<ProductFamilies />} />
                      <Route path="/stock/movements" element={<StockMovements />} />
                      <Route path="/stock/traceability" element={<StockTraceability />} />
                      
                      {/* Purchase Management */}
                      <Route path="/purchase/orders" element={<PurchaseOrders />} />
                      <Route path="/purchase/suppliers" element={<Suppliers />} />
                      
                      {/* Sales Management */}
                      <Route path="/sales/quotes" element={<Quotes />} />
                      <Route path="/sales/orders" element={<Orders />} />
                      <Route path="/sales/invoices" element={<Invoices />} />
                      <Route path="/sales/customers" element={<Customers />} />
                      
                      {/* Finance */}
                      <Route path="/finance/transactions" element={<Transactions />} />
                      <Route path="/finance/reconciliation" element={<BankReconciliation />} />
                      <Route path="/finance/cashflow" element={<CashFlow />} />
                      <Route path="/finance/accounts" element={<Accounts />} />
                      
                      {/* Analytics */}
                      <Route path="/analytics/vat" element={<VATDeclaration />} />
                      <Route path="/analytics/balance" element={<BalanceSheet />} />
                      
                      {/* Statistics */}
                      <Route path="/statistics" element={<Statistics />} />
                      
                      {/* Users */}
                      <Route path="/users" element={<Users />} />
                      <Route path="/profile" element={<Profile />} />
                    </Routes>
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
