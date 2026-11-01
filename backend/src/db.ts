import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create a new pool instance using your environment variables
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
});

// Prevent unhandled errors on idle database clients from crashing the server process
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL idle client error:', err);
});

export default pool;
