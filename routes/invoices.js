const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../middleware/auth');
const invoicesController = require('../controllers/invoicesController');

router.use(authenticate);

router.get('/',           invoicesController.getInvoices);
router.get('/:id',        invoicesController.getInvoiceById);
router.post('/',          invoicesController.createInvoice);
router.put('/:id',        invoicesController.updateInvoice);
router.delete('/:id',     authorizeRoles('super_admin', 'admin', 'accountant'), invoicesController.deleteInvoice);
router.patch('/:id/payment', invoicesController.updatePaymentStatus);

module.exports = router;
