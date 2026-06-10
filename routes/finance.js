// MC05 - Finance Module

const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../middleware/auth');
const financeController = require('../controllers/financeController');

router.use(authenticate);

// Health check (legacy)
router.get('/', financeController.getStatus);

// Transactions
router.get('/transactions',              financeController.getTransactions);
router.get('/transactions/:id',          financeController.getTransactionById);
router.post('/transactions',             financeController.createTransaction);
router.put('/transactions/:id',          financeController.updateTransaction);
router.delete('/transactions/:id',       authorizeRoles('super_admin','admin','accountant'), financeController.deleteTransaction);
router.post('/transactions/:id/reconcile', financeController.reconcileTransaction);

// Cash Flow
router.get('/cashflow',                  financeController.getCashFlow);

// Accounts
router.get('/accounts',                  financeController.getAccounts);
router.post('/accounts',                 financeController.createAccount);
router.put('/accounts/:id',              financeController.updateAccount);

// Summary
router.get('/summary',                   financeController.getFinancialSummary);

module.exports = router;
