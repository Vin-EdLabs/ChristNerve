import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
  console.log('ChristNerve DB connected');
});

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
});
