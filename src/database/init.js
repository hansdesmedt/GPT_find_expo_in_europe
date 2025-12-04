import pool from './db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize database schema if tables don't exist
 * This runs automatically on app startup in production
 */
export async function initializeDatabase() {
  try {
    console.log('🔍 Testing database connection...');

    // Test connection first
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL database');

    // Check if tables already exist
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'venues'
      ) as table_exists
    `);

    const tablesExist = tableCheck.rows[0].table_exists;

    if (!tablesExist) {
      console.log('📊 Database tables not found. Initializing schema...');

      const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
      await pool.query(schema);

      console.log('✅ Database schema initialized successfully');
    } else {
      console.log('✅ Database tables already exist');
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Make sure DATABASE_URL is set correctly');
    throw error;
  }
}
