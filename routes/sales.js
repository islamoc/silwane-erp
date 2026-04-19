// MC04 - Module Ventes (Sales Module)
// G16 - Gestion des ventes - Base (Sales Management)
// G17 - Demandes d'offre et proforma (Quotes and Proforma)
// G18 - Commandes client (Customer Orders)

const express = require('express');
const router = express.Router();
const { query: dbQuery } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
