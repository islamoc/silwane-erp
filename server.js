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

app.use(helmet());

const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

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

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

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

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

// =====================================================
// SERVER STARTUP
// =====================================================

const PORT = parseInt(process.env.PORT, 10) || 5000;

// Stored so shutdown handlers can call server.close()
let server;

const startServer = async () => {
  try {
    await testConnection();
    logger.info('Database connection established successfully');

    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`\n\uD83D\uDE80 Silwane ERP Server Started`);
      console.log(`\uD83D\uDCCB Proforma: FP26002386`);
      console.log(`\uD83C\uDFE2 Client: GK PRO STONES, Constantine`);
      console.log(`\uD83C\uDF0D Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`\uD83D\uDCBB Server: http://localhost:${PORT}`);
      console.log(`\uD83D\uDCCA API: http://localhost:${PORT}/api`);
      console.log(`\u2705 Health Check: http://localhost:${PORT}/health`);
      console.log(`\n\u2728 All 29 features implemented and ready!\n`);
    });

    // -------------------------------------------------------
    // Graceful EADDRINUSE handler
    // Attaching to the server 'error' event prevents Node from
    // throwing an unhandled exception and gives the user a
    // clear, actionable message instead of a raw stack trace.
    // -------------------------------------------------------
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n\u274C  Port ${PORT} is already in use.`);
        console.error(`    Another process is already listening on this port.`);
        console.error(`\n    Most likely causes:`);
        console.error(`      1. PM2 is already running this server`);
        console.error(`         Stop it first:  pm2 stop silwane-erp-api`);
        console.error(`         Then retry:     node server.js`);
        console.error(`      2. A previous instance was not shut down cleanly`);
        console.error(`         Find it:  netstat -ano | findstr :${PORT}`);
        console.error(`         Kill it:  taskkill /PID <pid> /F`);
        console.error(`      3. Another app is using port ${PORT}`);
        console.error(`         Change PORT in your .env file and restart.\n`);
        logger.error(`EADDRINUSE: port ${PORT} already in use - exiting`);
        process.exit(1);
      } else {
        // Re-throw any other server-level errors
        logger.error('Server error:', err);
        throw err;
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

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
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));   // Ctrl+C

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

startServer();

module.exports = app;
