/**
 * Unit tests for middleware/auth.js
 */
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';

jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: { on: jest.fn() },
  getClient: jest.fn(),
  transaction: jest.fn(),
  testConnection: jest.fn()
}));

jest.mock('../config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const { authenticate, authorize, authorizeRoles } = require('../middleware/auth');
const { generateToken } = require('../utils/generateToken');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('authenticate middleware', () => {
  test('should reject request with no token', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('should reject malformed Authorization header', async () => {
    const req = { headers: { authorization: 'Basic abc' } };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('should reject invalid token', async () => {
    const req = { headers: { authorization: 'Bearer invalidtoken' } };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('should reject expired token', async () => {
    const expiredToken = jwt.sign({ id: 1, email: 'test@test.com', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('expired') }));
  });

  test('should call next() with valid token and active user', async () => {
    const token = generateToken({ id: 1, email: 'admin@test.com', role: 'admin' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'admin', email: 'admin@test.com', first_name: 'Admin', last_name: 'User', is_active: true, role: 'admin', permissions: { all: true } }]
    });

    await authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(1);
  });

  test('should reject inactive user', async () => {
    const token = generateToken({ id: 2, email: 'inactive@test.com', role: 'viewer' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    db.query.mockResolvedValueOnce({
      rows: [{ id: 2, username: 'inactive', email: 'inactive@test.com', first_name: '', last_name: '', is_active: false, role: 'viewer', permissions: {} }]
    });

    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authorize middleware', () => {
  test('should allow super admin', () => {
    const req = { user: { permissions: { all: true } } };
    const res = mockRes();
    const next = jest.fn();
    authorize('some_permission')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('should allow user with required permission', () => {
    const req = { user: { permissions: { read_products: true } } };
    const res = mockRes();
    const next = jest.fn();
    authorize('read_products')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('should deny user without permission', () => {
    const req = { user: { permissions: {} } };
    const res = mockRes();
    const next = jest.fn();
    authorize('delete_user')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('should deny unauthenticated request', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    authorize('anything')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('authorizeRoles middleware', () => {
  test('should allow user with matching role', () => {
    const req = { user: { role: 'admin', id: 1 } };
    const res = mockRes();
    const next = jest.fn();
    authorizeRoles('admin', 'manager')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('should deny user with non-matching role', () => {
    const req = { user: { role: 'viewer', id: 1 } };
    const res = mockRes();
    const next = jest.fn();
    authorizeRoles('admin', 'manager')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('should deny unauthenticated request', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    authorizeRoles('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
