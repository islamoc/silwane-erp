/**
 * API Contract Test
 * Asserts that every path used in frontend/src/services/api.js
 * has a corresponding registered Express route in the backend.
 *
 * This is a static/structural test - no DB required.
 * Run: jest tests/apiContract.test.js
 */
'use strict';

const request = require('supertest');
const app = require('../server');

/**
 * Canonical REST contract derived from frontend/src/services/api.js.
 * For each entry: [method, path]
 * Parameterised paths use /0 (a literal ID) to hit the route matcher.
 */
const CONTRACT = [
  // Auth
  ['POST',   '/api/auth/login'],
  ['POST',   '/api/auth/refresh'],
  ['GET',    '/api/auth/profile'],
  ['POST',   '/api/auth/change-password'],
  ['GET',    '/api/auth/verify'],
  ['POST',   '/api/auth/logout'],

  // Products & Inventory
  ['GET',    '/api/products'],
  ['GET',    '/api/product-families'],
  ['GET',    '/api/stock-movements'],
  ['GET',    '/api/stock-movements/product/1/history'],

  // Suppliers
  ['GET',    '/api/suppliers'],

  // Purchases
  ['GET',    '/api/purchases/orders'],

  // Sales
  ['GET',    '/api/customers'],
  ['GET',    '/api/sales/quotes'],
  ['GET',    '/api/sales/orders'],

  // Invoices
  ['GET',    '/api/invoices'],

  // Finance
  ['GET',    '/api/finance/transactions'],
  ['GET',    '/api/finance/cashflow'],
  ['GET',    '/api/finance/accounts'],
  ['GET',    '/api/finance/summary'],

  // Analytics
  ['GET',    '/api/analytics/vat'],
  ['GET',    '/api/analytics/balance-sheet'],

  // Statistics
  ['GET',    '/api/statistics/dashboard'],
  ['GET',    '/api/statistics/sales'],
  ['GET',    '/api/statistics/invoices'],
  ['GET',    '/api/statistics/products'],
  ['GET',    '/api/statistics/customers'],

  // Users
  ['GET',    '/api/users'],
];

describe('API Contract: every frontend path has a registered backend route', () => {
  /**
   * We probe each route without auth tokens.
   * A route that exists will return 401 (auth required) or 400 (bad input).
   * A route that does NOT exist will return 404.
   * We assert statusCode !== 404.
   */
  test.each(CONTRACT)('%s %s responds with non-404', async (method, path) => {
    const res = await request(app)[method.toLowerCase()](path);
    expect(res.statusCode).not.toBe(404);
  });
});
