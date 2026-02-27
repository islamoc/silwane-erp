import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Axios instance with base URL and default headers.
 * Token key: 'erp_token' (consistent with AuthContext)
 */
const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ── Request interceptor: attach JWT token ─────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // Support both storage keys (new: erp_token, legacy: token)
    const token =
      localStorage.getItem('erp_token') ||
      localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 globally ─────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear all auth tokens and redirect to login
      localStorage.removeItem('erp_token');
      localStorage.removeItem('erp_user');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============ AUTH ============
export const loginUser = (email, password) =>
  api.post('/auth/login', { email, password });

export const registerUser = (userData) =>
  api.post('/auth/register', userData);

export const getProfile = () =>
  api.get('/auth/profile');

export const updateProfile = (data) =>
  api.put('/auth/profile', data);

export const changePassword = (currentPassword, newPassword) =>
  api.post('/auth/change-password', { currentPassword, newPassword });

export const verifyToken = () =>
  api.get('/auth/verify');

export const logoutUser = () =>
  api.post('/auth/logout');

// ============ PRODUCTS ============
export const getProducts = (params) =>
  api.get('/products', { params });

export const getProduct = (id) =>
  api.get(`/products/${id}`);

export const createProduct = (data) =>
  api.post('/products', data);

export const updateProduct = (id, data) =>
  api.put(`/products/${id}`, data);

export const deleteProduct = (id) =>
  api.delete(`/products/${id}`);

// ============ PRODUCT FAMILIES ============
export const getProductFamilies = (params) =>
  api.get('/product-families', { params });

export const getProductFamily = (id) =>
  api.get(`/product-families/${id}`);

export const createProductFamily = (data) =>
  api.post('/product-families', data);

export const updateProductFamily = (id, data) =>
  api.put(`/product-families/${id}`, data);

export const deleteProductFamily = (id) =>
  api.delete(`/product-families/${id}`);

// ============ STOCK MOVEMENTS ============
export const getStockMovements = (params) =>
  api.get('/stock-movements', { params });

export const getStockMovement = (id) =>
  api.get(`/stock-movements/${id}`);

export const createStockMovement = (data) =>
  api.post('/stock-movements', data);

export const updateStockMovement = (id, data) =>
  api.put(`/stock-movements/${id}`, data);

export const deleteStockMovement = (id) =>
  api.delete(`/stock-movements/${id}`);

export const getStockTraceability = (productId, params) =>
  api.get(`/stock-movements/traceability/${productId}`, { params });

// ============ SUPPLIERS ============
export const getSuppliers = (params) =>
  api.get('/suppliers', { params });

export const getSupplier = (id) =>
  api.get(`/suppliers/${id}`);

export const createSupplier = (data) =>
  api.post('/suppliers', data);

export const updateSupplier = (id, data) =>
  api.put(`/suppliers/${id}`, data);

export const deleteSupplier = (id) =>
  api.delete(`/suppliers/${id}`);

// ============ PURCHASE ORDERS ============
export const getPurchaseOrders = (params) =>
  api.get('/purchase-orders', { params });

export const getPurchaseOrder = (id) =>
  api.get(`/purchase-orders/${id}`);

export const createPurchaseOrder = (data) =>
  api.post('/purchase-orders', data);

export const updatePurchaseOrder = (id, data) =>
  api.put(`/purchase-orders/${id}`, data);

export const deletePurchaseOrder = (id) =>
  api.delete(`/purchase-orders/${id}`);

export const updatePurchaseOrderStatus = (id, status) =>
  api.patch(`/purchase-orders/${id}/status`, { status });

// ============ CUSTOMERS ============
export const getCustomers = (params) =>
  api.get('/customers', { params });

export const getCustomer = (id) =>
  api.get(`/customers/${id}`);

export const createCustomer = (data) =>
  api.post('/customers', data);

export const updateCustomer = (id, data) =>
  api.put(`/customers/${id}`, data);

export const deleteCustomer = (id) =>
  api.delete(`/customers/${id}`);

// ============ QUOTES ============
export const getQuotes = (params) =>
  api.get('/quotes', { params });

export const getQuote = (id) =>
  api.get(`/quotes/${id}`);

export const createQuote = (data) =>
  api.post('/quotes', data);

export const updateQuote = (id, data) =>
  api.put(`/quotes/${id}`, data);

export const deleteQuote = (id) =>
  api.delete(`/quotes/${id}`);

export const convertQuoteToOrder = (id) =>
  api.post(`/quotes/${id}/convert`);

// ============ ORDERS ============
export const getOrders = (params) =>
  api.get('/orders', { params });

export const getOrder = (id) =>
  api.get(`/orders/${id}`);

export const createOrder = (data) =>
  api.post('/orders', data);

export const updateOrder = (id, data) =>
  api.put(`/orders/${id}`, data);

export const deleteOrder = (id) =>
  api.delete(`/orders/${id}`);

export const updateOrderStatus = (id, status) =>
  api.patch(`/orders/${id}/status`, { status });

// ============ INVOICES ============
export const getInvoices = (params) =>
  api.get('/invoices', { params });

export const getInvoice = (id) =>
  api.get(`/invoices/${id}`);

export const createInvoice = (data) =>
  api.post('/invoices', data);

export const updateInvoice = (id, data) =>
  api.put(`/invoices/${id}`, data);

export const deleteInvoice = (id) =>
  api.delete(`/invoices/${id}`);

export const updatePaymentStatus = (id, status) =>
  api.patch(`/invoices/${id}/payment`, { status });

// ============ FINANCE ============
export const getTransactions = (params) =>
  api.get('/finance/transactions', { params });

export const getTransaction = (id) =>
  api.get(`/finance/transactions/${id}`);

export const createTransaction = (data) =>
  api.post('/finance/transactions', data);

export const updateTransaction = (id, data) =>
  api.put(`/finance/transactions/${id}`, data);

export const deleteTransaction = (id) =>
  api.delete(`/finance/transactions/${id}`);

export const reconcileTransaction = (id, data) =>
  api.post(`/finance/transactions/${id}/reconcile`, data);

export const getCashFlow = (params) =>
  api.get('/finance/cashflow', { params });

export const getAccounts = (params) =>
  api.get('/finance/accounts', { params });

export const createAccount = (data) =>
  api.post('/finance/accounts', data);

export const updateAccount = (id, data) =>
  api.put(`/finance/accounts/${id}`, data);

export const getFinancialSummary = (params) =>
  api.get('/finance/summary', { params });

// ============ ANALYTICS ============
export const getVATDeclaration = (params) =>
  api.get('/analytics/vat', { params });

export const getBalanceSheet = (params) =>
  api.get('/analytics/balance-sheet', { params });

// ============ STATISTICS ============
export const getDashboardStats = () =>
  api.get('/statistics/dashboard');

export const getSalesStats = (params) =>
  api.get('/statistics/sales', { params });

export const getInvoiceStats = (params) =>
  api.get('/statistics/invoices', { params });

export const getProductStats = (params) =>
  api.get('/statistics/products', { params });

export const getCustomerStats = (params) =>
  api.get('/statistics/customers', { params });

// ============ USERS ============
export const getUsers = (params) =>
  api.get('/interface/users', { params });

export const getUser = (id) =>
  api.get(`/interface/users/${id}`);

export const createUser = (data) =>
  api.post('/interface/users', data);

export const updateUser = (id, data) =>
  api.put(`/interface/users/${id}`, data);

export const deleteUser = (id) =>
  api.delete(`/interface/users/${id}`);

export const updateUserRole = (id, role) =>
  api.patch(`/interface/users/${id}/role`, { role });

// Legacy alias for AuthContext compatibility
export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const register = (userData) =>
  api.post('/auth/register', userData);

export const refreshToken = () =>
  api.post('/auth/refresh');

export default api;
