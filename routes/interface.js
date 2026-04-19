// MC08 - User Interface Module (Dashboard, Search, Filters)

const express = require('express');
const router = express.Router();
const { query: dbQuery } = require('../config/database');
const { authenticate, authorizeRoles } = require('../middleware/auth');
