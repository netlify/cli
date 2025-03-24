import { spawn } from 'child_process'
import { carefullyWriteFile } from './utils.js'
import BaseCommand from '../base-command.js'
import path from 'path'
import fs from 'fs'

export const initDrizzle = async (command: BaseCommand) => {
  if (!command.project.root) {
    throw new Error('Failed to initialize Drizzle in project. Project root not found.')
  }
  const drizzleConfigFilePath = path.resolve(command.project.root, 'drizzle.config.ts')
  await carefullyWriteFile(drizzleConfigFilePath, drizzleConfig)

  fs.mkdirSync(path.resolve(command.project.root, 'db'), { recursive: true })
  const schemaFilePath = path.resolve(command.project.root, 'db/schema.ts')
  await carefullyWriteFile(schemaFilePath, exampleDrizzleSchema)

  const dbIndexFilePath = path.resolve(command.project.root, 'db/index.ts')
  await carefullyWriteFile(dbIndexFilePath, exampleDbIndex)

  console.log('Adding drizzle-kit and drizzle-orm to the project')
  // install dev deps
  const devDepProc = spawn(
    command.project.packageManager?.installCommand ?? 'npm install',
    ['drizzle-kit@latest', '-D'],
    {
      stdio: 'inherit',
      shell: true,
    },
  )
  devDepProc.on('exit', (code) => {
    if (code === 0) {
      // install deps
      spawn(command.project.packageManager?.installCommand ?? 'npm install', ['drizzle-orm@latest'], {
        stdio: 'inherit',
        shell: true,
      })
    }
  })
}

const drizzleConfig = `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.NETLIFY_DATABASE_URL!
    },
    schema: './db/schema.ts'
});`

const exampleDrizzleSchema = `import { integer, pgTable, varchar, text } from 'drizzle-orm/pg-core';

export const post = pgTable('post', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    title: varchar({ length: 255 }).notNull(),
    content: text().notNull().default('')
});
`

const exampleDbIndex = `import { drizzle } from 'lib/db';
// import { drizzle } from '@netlify/database'
import * as schema from 'db/schema';

export const db = drizzle({
    schema
});
`
