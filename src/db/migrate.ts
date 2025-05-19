import 'dotenv/config';
import path from 'path';

import { neon as neonDriver } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { migrate as migrateNeon } from 'drizzle-orm/neon-http/migrator';

import { Pool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set for migration');
}

const migrationsFolder = path.join(process.cwd(), 'drizzle');

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev:worker';

const dbClientType = process.env.DB_CLIENT_TYPE || (isDev ? 'local_pg' : 'neon');

async function runMigrations() {
  console.log(`Running migrations with client type: ${dbClientType}`);
  try {
    console.log('Starting database migrations...');

    if (dbClientType === 'neon') {
      const sql = neonDriver(process.env.DATABASE_URL!);
      const db = drizzleNeon(sql);
      await migrateNeon(db, { migrationsFolder });
    } else {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
      const db = drizzlePg(pool);
      await migratePg(db, { migrationsFolder });
      await pool.end();
    }

    console.log('Migrations completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations(); 