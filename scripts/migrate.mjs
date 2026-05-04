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
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATION_ORDER = [
  // Basic table structure
  { name: 'schema.sql', path: join(__dirname, '..', 'src', 'db', 'schema.sql') },
  { name: 'seed.sql', path: join(__dirname, '..', 'src', 'db', 'seed.sql') },

  // All migration scripts (by order)
  { name: '001_add_job_favorites.sql', path: join(__dirname, '..', 'src', 'db', 'migrations', '001_add_job_favorites.sql') },
  { name: '002_add_referrals.sql', path: join(__dirname, '..', 'src', 'db', 'migrations', '002_add_referrals.sql') },
  { name: '003_add_reminders.sql', path: join(__dirname, '..', 'src', 'db', 'migrations', '003_add_reminders.sql') },
  { name: '004_add_resumes.sql', path: join(__dirname, '..', 'src', 'db', 'migrations', '004_add_resumes.sql') },
  { name: '005_add_profile_directions.sql', path: join(__dirname, '..', 'src', 'db', 'migrations', '005_add_profile_directions.sql') },
  { name: '006_add_users.sql', path: join(__dirname, '..', 'src', 'db', 'migrations', '006_add_users.sql') },
  { name: '007_add_user_profile_link.sql', path: join(__dirname, '..', 'src', 'db', 'migrations', '007_add_user_profile_link.sql') },
  { name: '008_add_company_fields.sql', path: join(__dirname, '..', 'src', 'db', 'migrations', '008_add_company_fields.sql') },
  { name: '009_optimize_indexes.sql', path: join(__dirname, '..', 'src', 'db', 'migrations', '009_optimize_indexes.sql') },
  { name: '010_add_default_user.sql', path: join(__dirname, '..', 'src', 'db', 'migrations', '010_add_default_user.sql') },
  { name: '011_fix_serial_sequences.sql', path: join(__dirname, '..', 'src', 'db', 'migrations', '011_fix_serial_sequences.sql') },
  { name: '012_enhanced_search_and_profiling.sql', path: join(__dirname, '..', 'src', 'db', 'migrations', '012_enhanced_search_and_profiling.sql') },

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
