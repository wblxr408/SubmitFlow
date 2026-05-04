/**
 * Database seed script
 * npm run db:seed
 */
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('Connected to database');

    const seedPath = join(__dirname, '..', 'src', 'db', 'seed.sql');
    const seedSql = readFileSync(seedPath, 'utf-8');
    await client.query(seedSql);
    console.log('Seed data inserted');

    console.log('Seed completed successfully');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
