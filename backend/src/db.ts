import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Also run standard fallback dotenv.config()
dotenv.config();



const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } ,
    })


// Prevent unhandled errors on idle database clients from crashing the server process
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL idle client error:', err);
});

export default pool;
