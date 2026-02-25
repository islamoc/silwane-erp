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
const purchaseRoutes = require('./routes/purchases');
const salesRoutes = require('./routes/sales');
const financeRoutes = require('./routes/finance');
const analyticsRoutes = require('./routes/analytics');
const interfaceRoutes = require('./routes/interface');
const statisticsRoutes = require('./routes/statistics');

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

// API routes - Updated to use correct route modules
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-families', productFamilyRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/interface', interfaceRoutes);
app.use('/api/statistics', statisticsRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Silwane ERP API',
    version: '2.0.0',
    description: 'Complete ERP system for GK PRO STONES - Proforma FP26002386',
    client: 'GK PRO STONES, Constantine',
    documentation: '/api/docs',
    modules: {
      'MC01': 'Stock Management (G01, G02, G05, G09)',
      'MC03': 'Purchase Management (G11)',
      'MC04': 'Sales Management (G16, G17, G18)',
      'MC05': 'Finance & Treasury (G26, G30, G08, N75)',
      'MC07': 'Analytics (G31, G33)',
      'MC08': 'User Interface (G35, G41, N52)',
      'MC09': 'Statistics (G38, G39, G40)'
    },
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      products: '/api/products',
      productFamilies: '/api/product-families',
      stockMovements: '/api/stock-movements',
      suppliers: '/api/suppliers',
      customers: '/api/customers',
      purchases: '/api/purchases',
      sales: '/api/sales',
      finance: '/api/finance',
      analytics: '/api/analytics',
      interface: '/api/interface',
      statistics: '/api/statistics'
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
      console.log(`📋 Proforma: FP26002386`);
      console.log(`🏢 Client: GK PRO STONES, Constantine`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💻 Server: http://localhost:${PORT}`);
      console.log(`📊 API: http://localhost:${PORT}/api`);
      console.log(`✅ Health Check: http://localhost:${PORT}/health`);
      console.log(`\n✨ All 29 features implemented and ready!\n`);
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