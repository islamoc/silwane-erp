// MC04 - Module Ventes (Sales Module)
// G16 - Gestion des ventes - Base (Sales Management)
// G17 - Demandes d'offre et proforma (Quotes and Proforma)
// G18 - Commandes client (Customer Orders)

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const salesController = require('../controllers/salesController');

// All routes require authentication
router.use(authenticate);

// Quotes / Proforma (G17)
router.get('/quotes',               salesController.getAllQuotes);
router.get('/quotes/:id',           salesController.getQuoteById);
router.post('/quotes',              salesController.createQuote);
router.put('/quotes/:id',           salesController.updateQuote);
router.post('/quotes/:id/convert',  salesController.convertQuoteToOrder);

// Sales Orders (G16, G18)
router.get('/orders',               salesController.getAllOrders);
router.get('/orders/:id',           salesController.getOrderById);
router.post('/orders',              salesController.createOrder);
router.put('/orders/:id',           salesController.updateOrder);

// Statistics (G16)
router.get('/statistics',           salesController.getSalesStatistics);

module.exports = router;
