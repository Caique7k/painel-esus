import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
  });

  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully:', res.rows[0]);
  } catch (err) {
    console.error('❌ Database connection failed:', err);
  } finally {
    await pool.end();
  }
}

testConnection();
