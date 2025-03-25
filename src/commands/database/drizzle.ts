import { spawn } from 'child_process'
import { carefullyWriteFile } from './utils.js'
import BaseCommand from '../base-command.js'
import path from 'path'
import fs from 'fs/promises'
import inquirer from 'inquirer'

export const initDrizzle = async (command: BaseCommand) => {
  if (!command.project.root) {
    throw new Error('Failed to initialize Drizzle in project. Project root not found.')
  }
  const drizzleConfigFilePath = path.resolve(command.project.root, 'drizzle.config.ts')
  await carefullyWriteFile(drizzleConfigFilePath, drizzleConfig)

  await fs.mkdir(path.resolve(command.project.root, 'db'), { recursive: true })
  const schemaFilePath = path.resolve(command.project.root, 'db/schema.ts')
  await carefullyWriteFile(schemaFilePath, exampleDrizzleSchema)

  const dbIndexFilePath = path.resolve(command.project.root, 'db/index.ts')
  await carefullyWriteFile(dbIndexFilePath, exampleDbIndex)

  const packageJsonPath = path.resolve(command.project.root, 'package.json')

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))

  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'updatePackageJson',
      message: `Add drizzle db commands to package.json?`,
    },
  ])
  if (answers.updatePackageJson) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    packageJson.scripts = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ...(packageJson.scripts ?? {}),
      ...packageJsonScripts,
    }
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
  if (!Object.keys(packageJson?.devDependencies ?? {}).includes('drizzle-kit')) {
    await spawnAsync(command.project.packageManager?.installCommand ?? 'npm install', ['drizzle-kit@latest', '-D'], {
      stdio: 'inherit',
      shell: true,
    })
  } else {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access
    console.log(`drizzle-kit already installed... Using version ${packageJson?.devDependencies?.['drizzle-kit']}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
  if (!Object.keys(packageJson?.dependencies ?? {}).includes('drizzle-orm')) {
    await spawnAsync(command.project.packageManager?.installCommand ?? 'npm install', ['drizzle-orm@latest'], {
      stdio: 'inherit',
      shell: true,
    })
  } else {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access
    console.log(`drizzle-orm already installed... Using version ${packageJson?.dependencies?.['drizzle-orm']}`)
  }
}

const drizzleConfig = `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.NETLIFY_DATABASE_URL!
    },
    schema: './db/schema.ts',
    out: './migrations'
});`

const exampleDrizzleSchema = `import { integer, pgTable, varchar, text } from 'drizzle-orm/pg-core';

export const posts = pgTable('posts', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    title: varchar({ length: 255 }).notNull(),
    content: text().notNull().default('')
});`

const exampleDbIndex = `import { neon } from '@netlify/neon';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from 'db/schema';

export const db = drizzle({
    schema,
    client: neon()
});`

const packageJsonScripts = {
  'db:generate': 'netlify dev:exec --context dev drizzle-kit generate',
  'db:migrate': 'netlify dev:exec --context dev drizzle-kit migrate',
  'db:studio': 'netlify dev:exec --context dev drizzle-kit studio',
  'db:push': 'netlify dev:exec --context dev drizzle-kit push',
}

const spawnAsync = (command: string, args: string[], options: Parameters<typeof spawn>[2]): Promise<number> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options)
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(code)
      }
      const errorMessage = code ? `Process exited with code ${code.toString()}` : 'Process exited with no code'
      reject(new Error(errorMessage))
    })
  })
}
