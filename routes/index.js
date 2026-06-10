/**
 * routes/index.js — TOMBSTONE
 *
 * This file is NOT imported by server.js and is intentionally left empty.
 *
 * History: the original version contained router.get() calls that referenced
 * controller methods which do not exist (e.g. financeController.getTransactions,
 * interfaceController.advancedSearch). Mounting that router would have thrown a
 * ReferenceError at startup. All routes it aimed to expose have been implemented
 * in their respective route modules (routes/finance.js, routes/analytics.js,
 * routes/statistics.js, routes/invoices.js) and are mounted directly in
 * server.js. This tombstone remains to document the history and prevent future
 * confusion.
 */

// (intentionally empty)
