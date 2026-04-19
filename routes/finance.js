// MC05 - Module Trésorerie et Finances (Treasury and Finance Module)
// G26 - Gestion de trésorerie - Base (Treasury Management)
// G30 - Catégorisation et remarques (Categorization and Notes)
// G08 - Règlement des bons (Payment/Settlement of Vouchers)
// N75 - Modèles d'échéances (Payment Terms Models)

const express = require('express');
const router = express.Router();
const { query: dbQuery } = require('../config/database');
const { authenticate, authorize, authorizeRoles } = require('../middleware/auth');
