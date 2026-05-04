/**
 * Database Migration Script
 * npm run db:migrate
 *
 * Execution order:
 * 1. schema.sql - Basic table structure
 * 2. seed.sql - Basic seed data
 * 3. migrations/006-011 - v1.3 migration scripts
 * 4. companies-extended.sql - Extended company data
 */
import { Client } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationDir = join(__dirname, '..', 'src', 'db', 'migrations');
const orderedMigrationFiles = readdirSync(migrationDir)
  .filter((name) => name.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b, 'en'));

const MIGRATION_ORDER = [
  // Basic table structure
  { name: 'schema.sql', path: join(__dirname, '..', 'src', 'db', 'schema.sql') },
  { name: 'seed.sql', path: join(__dirname, '..', 'src', 'db', 'seed.sql') },
  ...orderedMigrationFiles.map((name) => ({
    name,
    path: join(migrationDir, name),
  })),

  // Extended company data
  { name: 'companies-extended.sql', path: join(__dirname, '..', 'src', 'db', 'companies-extended.sql') },
];

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('Connected to database');

    for (const migration of MIGRATION_ORDER) {
      try {
        const sql = readFileSync(migration.path, 'utf-8');
        await client.query(sql);
        console.log(`Executed: ${migration.name}`);
      } catch (err) {
        // Ignore ON CONFLICT DO NOTHING errors
        if (err.code === '23505' || err.message.includes('duplicate')) {
          console.log(`Skipped (already exists): ${migration.name}`);
        } else {
          console.error(`Failed: ${migration.name}`);
          console.error(`  Error: ${err.message}`);
          throw err;
        }
      }
    }

    console.log('\nMigration completed successfully');
  } catch (err) {
    console.error('\nMigration failed');
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
