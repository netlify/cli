import fetch from 'node-fetch'
import { describe, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { withDevServer } from '../../utils/dev-server.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

describe('@netlify/dev integration', () => {
  describe('Makes Netlify Database available to functions', () => {
    test('When using @netlify/database directly', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        builder
          .withPackageJson({
            packageJson: {
              dependencies: { '@netlify/database': '0.7.0' },
            },
          })
          .withCommand({ command: ['npm', 'install'] })
          .withContentFile({
            path: 'netlify/functions/db-test.mjs',
            content: `
            import { getDatabase } from "@netlify/database";

            export default async () => {
              try {
                const { sql } = getDatabase();
                const rows = await sql\`SELECT 1 + 1 AS sum\`;
                return Response.json({ sum: rows[0].sum });
              } catch (error) {
                return Response.json({ error: error.message }, { status: 500 });
              }
            };

            export const config = { path: "/db-test" };
          `,
          })

        await builder.build()

        await withDevServer({ cwd: builder.directory }, async (server) => {
          const response = await fetch(`${server.url}/db-test`)
          const body = await response.text()
          t.expect(body).toEqual(JSON.stringify({ sum: 2 }))
        })
      })
    })

    test('when using drizzle-orm/netlify-db', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        builder
          .withPackageJson({
            packageJson: {
              dependencies: { '@netlify/database': '0.7.0', 'drizzle-orm': 'beta', 'drizzle-kit': 'beta' },
            },
          })
          .withCommand({ command: ['npm', 'install'] })
          .withContentFile({
            path: 'db/schema.ts',
            content: `
            import { doublePrecision, integer, pgTable, serial, text } from 'drizzle-orm/pg-core'

            export const planets = pgTable('planets', {
              id: serial('id').primaryKey(),
              name: text('name').notNull(),
              massKg: doublePrecision('mass_kg').notNull(),
              temperatureCelsius: integer('temperature_celsius').notNull(),
            })
          `,
          })
          .withContentFile({
            path: 'drizzle.config.ts',
            content: `
            import { defineConfig } from 'drizzle-kit'

            export default defineConfig({
              dialect: 'postgresql',
              schema: './db/schema.ts',
              out: 'netlify/database/migrations',
            })
          `,
          })
          .withCommand({ command: ['npx', 'drizzle-kit', 'generate'] })
          .withContentFile({
            path: 'netlify/database/migrations/99999999999999_seed_planets/migration.sql',
            content: `
            -- Seed data.
            INSERT INTO planets (name, mass_kg, temperature_celsius) VALUES
              ('Mercury', 3.30e23, 167),
              ('Venus', 4.87e24, 464),
              ('Earth', 5.97e24, 15),
              ('Mars', 6.42e23, -65),
              ('Jupiter', 1.898e27, -110),
              ('Saturn', 5.68e26, -140),
              ('Uranus', 8.68e25, -195),
              ('Neptune', 1.02e26, -200);
          `,
          })
          .withContentFile({
            path: 'netlify/functions/database-drizzle/database-drizzle.mjs',
            content: `
            import { drizzle } from 'drizzle-orm/netlify-db'

            import { planets } from '../../../db/schema'

            export default async () => {
              try {
                const db = drizzle()
                const rows = await db.select({ name: planets.name }).from(planets)

                return Response.json({ planets: rows })
              } catch (error) {
                return Response.json({ error: error.message }, { status: 500 });
              }
            };

            export const config = { path: "/database-drizzle" };
          `,
          })

        await builder.build()

        await callCli(['database', 'migrations', 'apply'], { cwd: builder.directory })

        await withDevServer({ cwd: builder.directory }, async (server) => {
          const response = await fetch(`${server.url}/database-drizzle`)
          const body = await response.json()
          t.expect(body).toEqual({
            planets: [
              { name: 'Mercury' },
              { name: 'Venus' },
              { name: 'Earth' },
              { name: 'Mars' },
              { name: 'Jupiter' },
              { name: 'Saturn' },
              { name: 'Uranus' },
              { name: 'Neptune' },
            ],
          })
        })
      })
    })
  })
})
