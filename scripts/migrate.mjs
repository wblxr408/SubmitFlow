/**
 * Database Migration Script
 * npm run db:migrate
 *
 * Execution order:
 * 1. schema.sql - Basic table structure
 * 2. seed.sql - Basic seed data
 * 3. migrations/001-017 - incremental migration scripts
 * 4. companies-extended.sql - Extended company data
 */
import { Client } from 'pg';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Load .env.local then .env into process.env (simple parser, no extra deps)
 */
function loadEnv() {
  for (const envFile of ['.env.local', '.env']) {
    if (!existsSync(envFile)) continue;
    const lines = readFileSync(envFile, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationDir = join(__dirname, '..', 'src', 'db', 'migrations');
const orderedMigrationFiles = readdirSync(migrationDir)
  .filter((name) => name.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b, 'en'));

const MIGRATION_ORDER = [
  { name: 'schema.sql', path: join(__dirname, '..', 'src', 'db', 'schema.sql') },
  { name: 'seed.sql', path: join(__dirname, '..', 'src', 'db', 'seed.sql') },
  ...orderedMigrationFiles.map((name) => ({
    name,
    path: join(migrationDir, name),
  })),
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
    console.error(String(err.stack || err));
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
