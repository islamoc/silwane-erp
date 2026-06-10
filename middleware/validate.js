const { validationResult } = require('express-validator');

/**
 * P2: Central express-validator error handler.
 * Usage: place after your check() array in a route:
 *   router.post('/login', loginValidation, validate, handler)
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = { validate };
