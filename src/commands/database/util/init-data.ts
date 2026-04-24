// Sample data used by the `database init` wizard. Kept in one place so the
// starter migration, the Drizzle schema, and the seed migration stay in sync.

export const STARTER_TABLE = 'planets'
export const STARTER_MIGRATION_NAME = 'create_planets'
export const SEED_MIGRATION_NAME = 'seed_planets'

const PLANETS_INSERT_VALUES = `  ('Mercury', 3.30e23, 167),
  ('Venus', 4.87e24, 464),
  ('Earth', 5.97e24, 15),
  ('Mars', 6.42e23, -65),
  ('Jupiter', 1.898e27, -110),
  ('Saturn', 5.68e26, -140),
  ('Uranus', 8.68e25, -195),
  ('Neptune', 1.02e26, -200)`

export const STARTER_MIGRATION_SQL = `-- Starter migration scaffolded by "netlify database init".
CREATE TABLE IF NOT EXISTS ${STARTER_TABLE} (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  mass_kg DOUBLE PRECISION NOT NULL,
  temperature_celsius INTEGER NOT NULL
);

INSERT INTO ${STARTER_TABLE} (name, mass_kg, temperature_celsius) VALUES
${PLANETS_INSERT_VALUES};
`

export const DRIZZLE_SCHEMA_TS = `import { doublePrecision, integer, pgTable, serial, text } from 'drizzle-orm/pg-core'

export const ${STARTER_TABLE} = pgTable('${STARTER_TABLE}', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  massKg: doublePrecision('mass_kg').notNull(),
  temperatureCelsius: integer('temperature_celsius').notNull(),
})
`

export const DRIZZLE_SEED_SQL = `-- Seed data scaffolded by "netlify database init".
INSERT INTO ${STARTER_TABLE} (name, mass_kg, temperature_celsius) VALUES
${PLANETS_INSERT_VALUES};
`

export const drizzleConfigTs = (migrationsOutPath: string): string => `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: '${migrationsOutPath}',
  dbCredentials: {
    url: process.env.NETLIFY_DATABASE_URL!,
  },
})
`
