import { carefullyWriteFile, getPackageJSON, spawnAsync } from './utils.js'
import BaseCommand from '../base-command.js'
import path from 'path'
import fs from 'fs/promises'
import inquirer from 'inquirer'
import { NETLIFY_NEON_PACKAGE_NAME } from './constants.js'

export const initDrizzle = async (command: BaseCommand) => {
  const workingDirectory = command.project.root ?? command.project.baseDirectory
  if (!workingDirectory) {
    throw new Error('Failed to initialize Drizzle. Project root or base directory not found.')
  }
  const opts = command.opts<{
    overwrite?: true | undefined
  }>()

  const drizzleConfigFilePath = path.resolve(workingDirectory, 'drizzle.config.ts')
  const schemaFilePath = path.resolve(workingDirectory, 'db/schema.ts')
  const dbIndexFilePath = path.resolve(workingDirectory, 'db/index.ts')
  if (opts.overwrite) {
    await fs.writeFile(drizzleConfigFilePath, drizzleConfig)
    await fs.mkdir(path.resolve(workingDirectory, 'db'), { recursive: true })
    await fs.writeFile(schemaFilePath, drizzleSchema)
    await fs.writeFile(dbIndexFilePath, dbIndex)
  } else {
    await carefullyWriteFile(drizzleConfigFilePath, drizzleConfig, workingDirectory)
    await fs.mkdir(path.resolve(workingDirectory, 'db'), { recursive: true })
    await carefullyWriteFile(schemaFilePath, drizzleSchema, workingDirectory)
    await carefullyWriteFile(dbIndexFilePath, dbIndex, workingDirectory)
  }

  const packageJsonPath = path.resolve(command.workingDir, 'package.json')
  const packageJson = getPackageJSON(command.workingDir)

  packageJson.scripts = {
    ...(packageJson.scripts ?? {}),
    ...packageJsonScripts,
  }
  if (opts.overwrite) {
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
  }

  type Answers = {
    updatePackageJson: boolean
  }

  if (!opts.overwrite) {
    const answers = await inquirer.prompt<Answers>([
      {
        type: 'confirm',
        name: 'updatePackageJson',
        message: `Add drizzle db commands to package.json?`,
      },
    ])
    if (answers.updatePackageJson) {
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
    }
  }

  if (!Object.keys(packageJson.devDependencies ?? {}).includes('drizzle-kit')) {
    await spawnAsync(command.project.packageManager?.name ?? 'npm', ['add', '-D', 'drizzle-kit@latest'], {
      stdio: 'inherit',
      shell: true,
    })
  }

  if (!Object.keys(packageJson.dependencies ?? {}).includes('drizzle-orm')) {
    await spawnAsync(command.project.packageManager?.name ?? 'npm', ['add', 'drizzle-orm@latest'], {
      stdio: 'inherit',
      shell: true,
    })
  }
}

const drizzleConfig = `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.NETLIFY_DATABASE_URL!
    },
    schema: './db/schema.ts',
    /**
     * Never edit the migrations directly, only use drizzle.
     * There are scripts in the package.json "db:generate" and "db:migrate" to handle this.
     */
    out: './migrations'
});`

const drizzleSchema = `import { integer, pgTable, varchar, text } from 'drizzle-orm/pg-core';

export const posts = pgTable('posts', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    title: varchar({ length: 255 }).notNull(),
    content: text().notNull().default('')
});`

const dbIndex = `import { neon } from '${NETLIFY_NEON_PACKAGE_NAME}';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

export const db = drizzle({
    schema,
    client: neon()
});`

const packageJsonScripts = {
  'db:generate': 'drizzle-kit generate',
  'db:migrate': 'netlify dev:exec drizzle-kit migrate',
  'db:studio': 'netlify dev:exec drizzle-kit studio',
}
