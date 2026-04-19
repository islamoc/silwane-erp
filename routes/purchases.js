// MC03 - Module Achats (Purchasing Module)
// G11 - Gestion des achats - Base (Purchase Management - Base)

const express = require('express');
const router = express.Router();
const { query: dbQuery } = require('../config/database');
const { authenticate, authorize, authorizeRoles } = require('../middleware/auth');
