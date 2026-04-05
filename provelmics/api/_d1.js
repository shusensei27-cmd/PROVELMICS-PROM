// api/_d1.js - Cloudflare D1 client via REST API
// Used in Vercel Functions to query Cloudflare D1

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}`;

/**
 * Execute a SQL query against Cloudflare D1
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<{results: Array, meta: Object}>}
 */
async function query(sql, params = []) {
  const response = await fetch(`${BASE_URL}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`D1 query failed: ${error}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`D1 error: ${JSON.stringify(data.errors)}`);
  }

  return data.result[0] || { results: [], meta: {} };
}

/**
 * Execute multiple SQL statements (for transactions)
 * @param {Array<{sql: string, params: Array}>} statements
 */
async function batch(statements) {
  const response = await fetch(`${BASE_URL}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(statements.map(s => ({ sql: s.sql, params: s.params || [] }))),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`D1 batch failed: ${error}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(`D1 batch error: ${JSON.stringify(data.errors)}`);
  }

  return data.result;
}

module.exports = { query, batch };
