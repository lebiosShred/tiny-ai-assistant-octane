const { drizzle } = require('drizzle-orm/neon-http');
const { neon } = require('@neondatabase/serverless');
const schema = require('./schema.js');

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

module.exports = { db, sql };
