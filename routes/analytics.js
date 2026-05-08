// Analytics Routes
// Wired strictly to functions exported by controllers/analyticsController.js

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// All analytics routes require authentication
router.use(authenticate);

// G31 - Product analytics sheet
router.get('/products/:id',        analyticsController.getProductAnalytics);
router.get('/products/:id/export', analyticsController.exportProductAnalytics);

// G33 - Customer analytics sheet
router.get('/customers/:id',       analyticsController.getCustomerAnalytics);

// G33 - Supplier analytics sheet
router.get('/suppliers/:id',       analyticsController.getSupplierAnalytics);

module.exports = router;
