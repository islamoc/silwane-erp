// Analytics Routes - MC Dashboard

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// All analytics routes require authentication
router.use(authenticate);

// Dashboard KPIs
router.get('/kpis', analyticsController.getKPIs);

// Revenue trends
router.get('/revenue', analyticsController.getRevenueTrends);

// Top products
router.get('/top-products', analyticsController.getTopProducts);

// Top customers
router.get('/top-customers', analyticsController.getTopCustomers);

// Stock alerts
router.get('/stock-alerts', analyticsController.getStockAlerts);

// Recent activity
router.get('/recent-activity', analyticsController.getRecentActivity);

module.exports = router;
