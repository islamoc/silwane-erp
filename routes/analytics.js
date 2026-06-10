// Analytics Routes — MC07

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

router.use(authenticate);

// Per-entity analytics sheets (existing)
router.get('/products/:id',        analyticsController.getProductAnalytics);
router.get('/products/:id/export', analyticsController.exportProductAnalytics);
router.get('/customers/:id',       analyticsController.getCustomerAnalytics);
router.get('/suppliers/:id',       analyticsController.getSupplierAnalytics);

// Report-level analytics (previously missing)
router.get('/vat',                 analyticsController.getVATDeclaration);
router.get('/balance-sheet',       analyticsController.getBalanceSheet);

module.exports = router;
