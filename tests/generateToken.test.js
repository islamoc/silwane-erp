/**
 * Unit tests for utils/generateToken.js
 */
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
process.env.JWT_EXPIRE = '1h';
process.env.JWT_REFRESH_EXPIRE = '7d';

const { generateToken, generateRefreshToken, verifyToken } = require('../utils/generateToken');
const jwt = require('jsonwebtoken');

describe('generateToken', () => {
  const mockUser = { id: 1, email: 'test@test.com', role: 'admin' };

  test('should generate a valid JWT token', () => {
    const token = generateToken(mockUser);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(mockUser.id);
    expect(decoded.email).toBe(mockUser.email);
    expect(decoded.role).toBe(mockUser.role);
  });

  test('should default role to viewer if not provided', () => {
    const token = generateToken({ id: 2, email: 'user@test.com' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.role).toBe('viewer');
  });
});

describe('generateRefreshToken', () => {
  test('should generate a valid refresh token', () => {
    const token = generateRefreshToken({ id: 1 });
    expect(token).toBeTruthy();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(1);
  });
});

describe('verifyToken', () => {
  test('should verify a valid token', () => {
    const token = generateToken({ id: 1, email: 'test@test.com', role: 'admin' });
    const decoded = verifyToken(token);
    expect(decoded.id).toBe(1);
  });

  test('should throw on invalid token', () => {
    expect(() => verifyToken('invalid-token')).toThrow('Invalid or expired token');
  });

  test('should throw on expired token', () => {
    const expiredToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    expect(() => verifyToken(expiredToken)).toThrow('Invalid or expired token');
  });
});
