const express = require('express');
const router = express.Router();

// Import controllers
const stockController = require('../controllers/stockController');
const financeController = require('../controllers/financeController');
const analyticsController = require('../controllers/analyticsController');
const statisticsController = require('../controllers/statisticsController');
const interfaceController = require('../controllers/interfaceController');

// Middleware
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// ============================================
// MC01 - Stock Management Routes
// ============================================

// G01 - Stock Management Base
router.get('/stock/products', stockController.getProducts);

// G02 - Hierarchical Families
router.get('/stock/families', stockController.getProductFamilies);

// G05 - Weight, Volume and Dimensions
router.put('/stock/products/:id/dimensions', stockController.updateProductDimensions);

// G09 - Stock Movement Journal
router.get('/stock/movements', stockController.getStockMovementJournal);
router.get('/stock/alerts', stockController.getLowStockAlerts);
router.post('/stock/movements/bulk', stockController.bulkStockUpdate);

// ============================================
// MC05 - Finance & Treasury Routes
// ============================================

// G26 - Treasury Management Base
router.get('/finance/transactions', financeController.getTransactions);

// G30 - Categorization and Remarks
router.put('/finance/transactions/:id/category', financeController.updateTransactionCategory);

// G08 - Voucher Settlement
router.get('/finance/vouchers', financeController.getVouchers);
router.post('/finance/vouchers/:id/settle', financeController.settleVoucher);

// N75 - Payment Schedule Models
router.get('/finance/payment-models', financeController.getPaymentScheduleModels);
router.post('/finance/payment-models', financeController.createPaymentScheduleModel);
router.post('/finance/payment-schedules', financeController.applyPaymentSchedule);

// Cash Flow Reporting
router.get('/finance/cashflow', financeController.getCashFlowReport);

// ============================================
// MC07 - Analytics Routes
// ============================================

// G31 - Product Sheet + Stock Sheet
router.get('/analytics/products/:id', analyticsController.getProductAnalytics);
router.get('/analytics/products/:id/export', analyticsController.exportProductAnalytics);

// G33 - Customer/Supplier Analytics Sheet
router.get('/analytics/customers/:id', analyticsController.getCustomerAnalytics);
router.get('/analytics/suppliers/:id', analyticsController.getSupplierAnalytics);

// ============================================
// MC08 - User Interface Routes
// ============================================

// G35 - Information Dashboard Bar
router.get('/interface/dashboard', interfaceController.getDashboardInfo);

// G41 - Advanced Search and Filters
router.post('/interface/search/advanced', interfaceController.advancedSearch);
router.get('/interface/search/filters/:entity_type', interfaceController.getAvailableFilters);

// N52 - Column-based Search
router.get('/interface/search/column', interfaceController.columnSearch);

// Search Templates
router.get('/interface/search/templates', interfaceController.getSearchTemplates);
router.post('/interface/search/templates', interfaceController.saveSearchTemplate);

// ============================================
// MC09 - Statistics Routes
// ============================================

// G38 - Global Tier Situation
router.get('/statistics/tier-situation', statisticsController.getGlobalTierSituation);

// G39 - Basic Statistics
router.get('/statistics/basic', statisticsController.getBasicStatistics);

// G40 - Statistical Reports
router.get('/statistics/reports', statisticsController.getStatisticalReport);

// Dashboard Overview
router.get('/statistics/dashboard', statisticsController.getDashboardOverview);

module.exports = router;