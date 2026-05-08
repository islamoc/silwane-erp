// MC05 - Finance Module (placeholder — routes to be implemented)

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const financeController = require('../controllers/financeController');

router.use(authenticate);

// Placeholder health-check route
router.get('/', financeController.getStatus);

module.exports = router;
