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

// ── Request interceptor: attach JWT token ─────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
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

// ── Response interceptor: handle 401 globally ──────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
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

/**
 * Stock traceability for a product.
 * Backend route: GET /api/stock-movements/product/:productId/history
 * (was /traceability/:productId — now aligned with the backend path)
 */
export const getStockTraceability = (productId, params) =>
  api.get(`/stock-movements/product/${productId}/history`, { params });

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
// Canonical backend path: /api/purchases/orders
export const getPurchaseOrders = (params) =>
  api.get('/purchases/orders', { params });

export const getPurchaseOrder = (id) =>
  api.get(`/purchases/orders/${id}`);

export const createPurchaseOrder = (data) =>
  api.post('/purchases/orders', data);

export const updatePurchaseOrder = (id, data) =>
  api.put(`/purchases/orders/${id}`, data);

export const deletePurchaseOrder = (id) =>
  api.delete(`/purchases/orders/${id}`);

export const updatePurchaseOrderStatus = (id, status) =>
  api.patch(`/purchases/orders/${id}/status`, { status });

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
// Canonical backend path: /api/sales/quotes
export const getQuotes = (params) =>
  api.get('/sales/quotes', { params });

export const getQuote = (id) =>
  api.get(`/sales/quotes/${id}`);

export const createQuote = (data) =>
  api.post('/sales/quotes', data);

export const updateQuote = (id, data) =>
  api.put(`/sales/quotes/${id}`, data);

export const deleteQuote = (id) =>
  api.delete(`/sales/quotes/${id}`);

export const convertQuoteToOrder = (id) =>
  api.post(`/sales/quotes/${id}/convert`);

// ============ ORDERS ============
// Canonical backend path: /api/sales/orders
export const getOrders = (params) =>
  api.get('/sales/orders', { params });

export const getOrder = (id) =>
  api.get(`/sales/orders/${id}`);

export const createOrder = (data) =>
  api.post('/sales/orders', data);

export const updateOrder = (id, data) =>
  api.put(`/sales/orders/${id}`, data);

export const deleteOrder = (id) =>
  api.delete(`/sales/orders/${id}`);

export const updateOrderStatus = (id, status) =>
  api.patch(`/sales/orders/${id}/status`, { status });

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
// Canonical backend path: /api/users  (was /interface/users in the frontend)
export const getUsers = (params) =>
  api.get('/users', { params });

export const getUser = (id) =>
  api.get(`/users/${id}`);

export const createUser = (data) =>
  api.post('/users', data);

export const updateUser = (id, data) =>
  api.put(`/users/${id}`, data);

export const deleteUser = (id) =>
  api.delete(`/users/${id}`);

export const updateUserRole = (id, role) =>
  api.patch(`/users/${id}/role`, { role });

// Legacy alias for AuthContext compatibility
export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const register = (userData) =>
  api.post('/auth/register', userData);

/**
 * Refresh the JWT access token.
 * Backend: POST /api/auth/refresh — expects { refreshToken } in body.
 */
export const refreshToken = (token) =>
  api.post('/auth/refresh', { refreshToken: token });

export default api;
