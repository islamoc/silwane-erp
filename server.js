const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./config/logger');
const { pool, testConnection } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const productFamilyRoutes = require('./routes/productFamilies');
const stockMovementRoutes = require('./routes/stockMovements');
const supplierRoutes = require('./routes/suppliers');
const customerRoutes = require('./routes/customers');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const salesQuoteRoutes = require('./routes/salesQuotes');
const salesOrderRoutes = require('./routes/salesOrders');
const financialTransactionRoutes = require('./routes/financialTransactions');
const voucherRoutes = require('./routes/vouchers');
const paymentScheduleRoutes = require('./routes/paymentSchedules');
const analyticsRoutes = require('./routes/analytics');
const statisticsRoutes = require('./routes/statistics');
const settingsRoutes = require('./routes/settings');

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// =====================================================
// ROUTES
// =====================================================

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-families', productFamilyRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/sales-quotes', salesQuoteRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/financial-transactions', financialTransactionRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/payment-schedules', paymentScheduleRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/settings', settingsRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Silwane ERP API',
    version: '1.0.0',
    description: 'Complete ERP system with inventory, purchasing, sales, finance, analytics and statistics',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      products: '/api/products',
      productFamilies: '/api/product-families',
      stockMovements: '/api/stock-movements',
      suppliers: '/api/suppliers',
      customers: '/api/customers',
      purchaseOrders: '/api/purchase-orders',
      salesQuotes: '/api/sales-quotes',
      salesOrders: '/api/sales-orders',
      financialTransactions: '/api/financial-transactions',
      vouchers: '/api/vouchers',
      paymentSchedules: '/api/payment-schedules',
      analytics: '/api/analytics',
      statistics: '/api/statistics',
      settings: '/api/settings'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// =====================================================
// SERVER STARTUP
// =====================================================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    logger.info('Database connection established successfully');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`\n🚀 Silwane ERP Server Started`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💻 Server: http://localhost:${PORT}`);
      console.log(`📊 API: http://localhost:${PORT}/api`);
      console.log(`✅ Health Check: http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  pool.end(() => {
    logger.info('Database pool closed');
    process.exit(0);
  });
});

startServer();

module.exports = app;