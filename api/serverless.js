'use strict';

// Import the existing Express app from server.js
// server.js exports `app` as module.exports
const app = require('../server');

// Vercel serverless handler
// This wraps the Express app for serverless function deployment
module.exports = async function handler(req, res) {
  // Clear any cached database connections between invocations
  // This prevents connection exhaustion on serverless platforms
  if (process.env.VERCEL) {
    const { pool } = require('../config/database');
    // Only close idle connections, not active ones
    try {
      await pool.end();
    } catch (e) {
      // Ignore errors on pool end between invocations
    }
    // Re-create pool for new request if needed
    delete require.cache[require.resolve('../config/database')];
    delete require.cache[require.resolve('../server')];
  }

  // Re-import fresh for this invocation
  const freshApp = require('../server');
  return freshApp(req, res);
};
