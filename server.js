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
const authRoutes           = require('./routes/auth');
const userRoutes           = require('./routes/users');
const productRoutes        = require('./routes/products');
const productFamilyRoutes  = require('./routes/productFamilies');
const stockMovementRoutes  = require('./routes/stockMovements');
const supplierRoutes       = require('./routes/suppliers');
const customerRoutes       = require('./routes/customers');
const purchaseRoutes       = require('./routes/purchases');
const salesRoutes          = require('./routes/sales');
const invoiceRoutes        = require('./routes/invoices');
const financeRoutes        = require('./routes/finance');
const analyticsRoutes      = require('./routes/analytics');
const interfaceRoutes      = require('./routes/interface');
const statisticsRoutes     = require('./routes/statistics');

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Silwane ERP API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// =====================================================
// API ROUTES
// =====================================================

app.use('/api/auth',             authRoutes);
app.use('/api/users',            userRoutes);
app.use('/api/products',         productRoutes);
app.use('/api/product-families', productFamilyRoutes);
app.use('/api/stock-movements',  stockMovementRoutes);
app.use('/api/suppliers',        supplierRoutes);
app.use('/api/customers',        customerRoutes);
app.use('/api/purchases',        purchaseRoutes);
app.use('/api/sales',            salesRoutes);
app.use('/api/invoices',         invoiceRoutes);   // <-- added
app.use('/api/finance',          financeRoutes);
app.use('/api/analytics',        analyticsRoutes);
app.use('/api/interface',        interfaceRoutes);
app.use('/api/statistics',       statisticsRoutes);

// =====================================================
// ROOT
// =====================================================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Silwane ERP API',
    docs: '/api',
    health: '/health'
  });
});

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// =====================================================
// ERROR HANDLER
// =====================================================

app.use(errorHandler);

// =====================================================
// SERVER STARTUP
// =====================================================

const PORT = parseInt(process.env.PORT, 10) || 5000;
let server;

const startServer = async () => {
  try {
    await testConnection();
    logger.info('Database connection established successfully');

    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`\n🚀 Silwane ERP Server Started`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💻 Server: http://localhost:${PORT}`);
      console.log(`📊 API:    http://localhost:${PORT}/api`);
      console.log(`✅ Health:  http://localhost:${PORT}/health\n`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌  Port ${PORT} is already in use.`);
        logger.error(`EADDRINUSE: port ${PORT} already in use - exiting`);
        process.exit(1);
      } else {
        logger.error('Server error:', err);
        throw err;
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// =====================================================
// PROCESS SIGNAL HANDLERS
// =====================================================

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      pool.end(() => {
        logger.info('Database pool closed');
        process.exit(0);
      });
    });
  } else {
    pool.end(() => process.exit(0));
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

module.exports = app;
