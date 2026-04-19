/**
 * Unit tests for middleware/errorHandler.js
 */
process.env.NODE_ENV = 'test';

jest.mock('../config/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const errorHandler = require('../middleware/errorHandler');

const mockReq = (method = 'GET', path = '/test') => ({
  method, path, ip: '127.0.0.1', user: null
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('errorHandler middleware', () => {
  test('should return 500 for generic errors', () => {
    const err = new Error('Something went wrong');
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test('should handle PostgreSQL unique violation (23505) with 400', () => {
    const err = { code: '23505', message: 'duplicate key', stack: '' };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Duplicate entry')
    }));
  });

  test('should handle PostgreSQL foreign key violation (23503) with 400', () => {
    const err = { code: '23503', message: 'fk violation', stack: '' };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should handle PostgreSQL not null violation (23502) with 400', () => {
    const err = { code: '23502', message: 'not null', stack: '' };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Required field is missing.'
    }));
  });

  test('should handle JsonWebTokenError with 401', () => {
    const err = new Error('invalid signature');
    err.name = 'JsonWebTokenError';
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Invalid token'
    }));
  });

  test('should handle TokenExpiredError with 401', () => {
    const err = new Error('jwt expired');
    err.name = 'TokenExpiredError';
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Token expired'
    }));
  });

  test('should handle MulterError file size limit with 400', () => {
    const err = { name: 'MulterError', code: 'LIMIT_FILE_SIZE', message: '', stack: '' };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'File size too large'
    }));
  });
});
