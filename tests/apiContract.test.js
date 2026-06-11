'use strict';

/**
 * API Contract Test
 * ==================
 * Asserts that every path used in frontend/src/services/api.js
 * has a corresponding registered Express route in the backend.
 *
 * Also validates RBAC rules: protected routes return 401 (not 404)
 * when called without a token — proving the route is registered and
 * the authenticate middleware is applied.
 *
 * This is a static/structural test — no DB required.
 * Run: jest tests/apiContract.test.js
 */

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

  // Users (admin only)
  ['GET',    '/api/users'],
];

/**
 * RBAC enforcement matrix.
 * Routes listed here require authentication AND a specific role.
 * Without a token the backend MUST return 401 (route exists + auth applied).
 * With a low-privilege token it MUST return 403 (RBAC applied).
 *
 * Format: [method, path, 'description of expected restriction']
 */
const RBAC_PROTECTED = [
  // DELETE purchase order — viewer gets 403, manager/admin get 200|404
  ['DELETE', '/api/purchases/orders/0', 'viewer cannot delete purchase order'],
  // GET /api/users — only admin role allowed
  ['GET',    '/api/users',              'non-admin cannot list users'],
    ['DELETE', '/api/sales/quotes/0',       'non-manager cannot delete quotes'],
  ['DELETE', '/api/sales/orders/0',       'non-manager cannot delete orders'],
  ['PATCH',  '/api/sales/quotes/0/status','unauthenticated patch quote status gets 401'],
  ['PATCH',  '/api/sales/orders/0/status','unauthenticated patch order status gets 401'],
];

describe('API Contract — route existence (no auth token → 401, not 404)', () => {
  CONTRACT.forEach(([method, path]) => {
    it(`${method} ${path} is registered`, async () => {
      const res = await request(app)[method.toLowerCase()](path);
      // A 404 means the route is NOT registered at all.
      // Any other status (401, 403, 400, 200 …) proves the route exists.
      expect(res.status).not.toBe(404);
    });
  });
});

describe('API Contract — RBAC enforcement (no token → 401)', () => {
  RBAC_PROTECTED.forEach(([method, path, desc]) => {
    it(`${method} ${path} — ${desc} — unauthenticated gets 401`, async () => {
      const res = await request(app)[method.toLowerCase()](path);
      // Without a token, authenticate() must block with 401.
      expect(res.status).toBe(401);
    });
  });
});

describe('API Contract — response envelope shape', () => {
  it('POST /api/auth/login with invalid credentials returns { success: false }', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('message');
  });

  it('GET /api/products without token returns { success: false }', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('message');
  });
});
