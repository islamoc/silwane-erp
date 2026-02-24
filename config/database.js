const { Pool } = require('pg');
const logger = require('./logger');

// Database configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'silwane_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait when connecting a new client
};

// Create connection pool
const pool = new Pool(config);

// Pool error handler
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', err);
});

// Pool connect handler
pool.on('connect', (client) => {
  logger.debug('New client connected to database');
});

// Pool acquire handler
pool.on('acquire', (client) => {
  logger.debug('Client acquired from pool');
});

// Pool remove handler
pool.on('remove', (client) => {
  logger.debug('Client removed from pool');
});

/**
 * Test database connection
 */
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection test successful', {
      timestamp: result.rows[0].now
    });
    return true;
  } catch (error) {
    logger.error('Database connection test failed', error);
    throw error;
  }
};

/**
 * Execute a query with parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', {
      query: text,
      duration: `${duration}ms`,
      rows: result.rowCount
    });
    return result;
  } catch (error) {
    logger.error('Query execution failed', {
      query: text,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 */
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;

  // Set a timeout of 5 seconds, after which we will log a warning
  const timeout = setTimeout(() => {
    logger.warn('A client has been checked out for more than 5 seconds!');
  }, 5000);

  // Monkey patch the query method to track queries
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };

  // Monkey patch the release method to clear timeout
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release.apply(client);
  };

  return client;
};

/**
 * Transaction helper
 * @param {Function} callback - Async function to execute within transaction
 */
const transaction = async (callback) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  testConnection
};