// Statistics Routes — MC09

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const statisticsController = require('../controllers/statisticsController');

router.use(authenticate);

// Existing routes (unchanged)
router.get('/dashboard',      statisticsController.getDashboardOverview);
router.get('/sales',          statisticsController.getSalesStatistics);

// Previously missing — added to match frontend/src/services/api.js
router.get('/invoices',       statisticsController.getInvoiceStatistics);
router.get('/products',       statisticsController.getProductStatistics);
router.get('/customers',      statisticsController.getCustomerStatistics);

module.exports = router;
