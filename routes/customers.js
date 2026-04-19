// Customers Management for MC04 Sales Module

const express = require('express');
const router = express.Router();
const { query: dbQuery } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
