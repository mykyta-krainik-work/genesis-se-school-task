import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set. Ensure .env is loaded.");

  throw new Error("DATABASE_URL environment variable is not set");
}

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev:worker';

let dbInstance;
const dbClientType = process.env.DB_CLIENT_TYPE || (isDev ? 'local_pg' : 'neon');

if (dbClientType === 'neon') {
  console.log("Using Neon HTTP driver for database connection.");

  const sql = neon(process.env.DATABASE_URL!);

  dbInstance = drizzleNeon(sql, { schema, logger: process.env.NODE_ENV === 'development' });
} else {
  console.log("Using node-postgres (pg) driver for database connection.");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
  });
  dbInstance = drizzlePg(pool, { schema, logger: process.env.NODE_ENV === 'development' });
}

export const db = dbInstance;

export * from './schema';
