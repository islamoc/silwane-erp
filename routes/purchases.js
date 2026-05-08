// MC03 - Module Achats (Purchasing Module)
// G11 - Gestion des achats - Base (Purchase Management - Base)

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const purchasesController = require('../controllers/purchasesController');

// All routes require authentication
router.use(authenticate);

// Purchase Orders
router.get('/orders',                               purchasesController.getAllPurchaseOrders);
router.get('/orders/:id',                           purchasesController.getPurchaseOrderById);
router.post('/orders',                              purchasesController.createPurchaseOrder);
router.put('/orders/:id',                           purchasesController.updatePurchaseOrder);
router.delete('/orders/:id',  authorize('admin', 'manager'), purchasesController.cancelPurchaseOrder);

// Statistics & analytics
router.get('/statistics',                           purchasesController.getPurchaseStatistics);
router.get('/reorder-suggestions',                  purchasesController.getReorderSuggestions);
router.post('/auto-order',                          purchasesController.createAutoOrder);

// Supplier performance
router.get('/suppliers/:id/performance',            purchasesController.getSupplierPerformance);

module.exports = router;
