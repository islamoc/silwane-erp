// MC Interface / UI configuration routes (placeholder — routes to be implemented)

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const interfaceController = require('../controllers/interfaceController');

router.use(authenticate);

// Placeholder health-check route
router.get('/', interfaceController.getStatus);

module.exports = router;
