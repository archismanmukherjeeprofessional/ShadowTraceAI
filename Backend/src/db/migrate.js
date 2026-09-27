/**
 * ShadowTrace AI — Database Migration Runner
 * Usage: node src/db/migrate.js
 * Safe to re-run — all statements use IF NOT EXISTS.
 */
"use strict";
require("dotenv").config();
const { Pool } = require("pg");
const fs       = require("fs");
const path     = require("path");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const client = await pool.connect();
  try {
    console.log("Running ShadowTrace AI database migration...");
    await client.query(sql);
    console.log("Migration complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error("Migration failed:", err.message); process.exit(1); });
