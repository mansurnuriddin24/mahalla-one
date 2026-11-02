import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;
const port = process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432;

if (!connectionString && (!sqlHost || !sqlDbName || !user)) {
  throw new Error('DATABASE_URL or (SQL_HOST, SQL_DB_NAME, SQL_ADMIN_USER/SQL_USER) must be set in environment variables.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: connectionString
    ? {
        url: connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
      }
    : {
        host: sqlHost || 'localhost',
        user: user || 'postgres',
        password: password || '',
        database: sqlDbName || 'mahalla_one',
        port,
        ssl: process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : false,
      },
  verbose: true,
});
