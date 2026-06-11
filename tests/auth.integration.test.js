/**
 * Integration tests for Auth routes
 * Requires a running PostgreSQL instance (use TEST_DATABASE_URL).
 * Run: jest tests/auth.integration.test.js --forceExit
 *
 * NOTE: These are integration-level tests using supertest.
 * They require the DB to be seeded with the test schema.
 * Set NODE_ENV=test and TEST_DATABASE_URL before running.
 */
'use strict';

const request = require('supertest');
const app = require('../server');

// Skip if no test DB configured
const RUN_INTEGRATION = !!process.env.TEST_DATABASE_URL;

const describeOrSkip = RUN_INTEGRATION ? describe : describe.skip;

describeOrSkip('POST /api/auth/login', () => {
  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong' });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 + tokens with valid credentials', async () => {
    // Requires a seeded user: admin@silwane.com / Admin@123
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.TEST_ADMIN_EMAIL || 'admin@silwane.com',
        password: process.env.TEST_ADMIN_PASSWORD || 'Admin@123',
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data).toHaveProperty('refreshToken');
  });
});

describeOrSkip('POST /api/auth/refresh', () => {
  let refreshToken;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.TEST_ADMIN_EMAIL || 'admin@silwane.com',
        password: process.env.TEST_ADMIN_PASSWORD || 'Admin@123',
      });
    refreshToken = res.body.data?.refreshToken;
  });

  it('returns 400 when no refresh token provided', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.statusCode).toBe(400);
  });

  it('returns new access token with valid refresh token', async () => {
    if (!refreshToken) return;
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('token');
  });
});

describeOrSkip('GET /api/auth/verify', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.TEST_ADMIN_EMAIL || 'admin@silwane.com',
        password: process.env.TEST_ADMIN_PASSWORD || 'Admin@123',
      });
    token = res.body.data?.token;
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/verify');
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    if (!token) return;
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
