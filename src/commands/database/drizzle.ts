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
  const opts = command.opts<{
    overwrite?: true | undefined
    devBranchUri?: string | undefined
  }>()
  const devBranchUri = opts.devBranchUri
  const drizzleDevConfigFilePath = path.resolve(command.project.root, 'drizzle-dev.config.ts')
  const drizzleConfigFilePath = path.resolve(command.project.root, 'drizzle-prod.config.ts')
  const schemaFilePath = path.resolve(command.project.root, 'db/schema.ts')
  const dbIndexFilePath = path.resolve(command.project.root, 'db/index.ts')
  if (opts.overwrite) {
    if (devBranchUri) {
      await fs.writeFile(drizzleDevConfigFilePath, createDrizzleDevConfigContent(devBranchUri))
    }
    await fs.writeFile(drizzleConfigFilePath, drizzleConfig)
    await fs.mkdir(path.resolve(command.project.root, 'db'), { recursive: true })
    await fs.writeFile(schemaFilePath, exampleDrizzleSchema)
    await fs.writeFile(dbIndexFilePath, exampleDbIndex)
  } else {
    if (devBranchUri) {
      await carefullyWriteFile(
        drizzleDevConfigFilePath,
        createDrizzleDevConfigContent(devBranchUri),
        command.project.root,
      )
    }
    await carefullyWriteFile(drizzleConfigFilePath, drizzleConfig, command.project.root)
    await fs.mkdir(path.resolve(command.project.root, 'db'), { recursive: true })
    await carefullyWriteFile(schemaFilePath, exampleDrizzleSchema, command.project.root)
    await carefullyWriteFile(dbIndexFilePath, exampleDbIndex, command.project.root)
  }

  const packageJsonPath = path.resolve(command.project.root, 'package.json')

  if (devBranchUri) {
    const gitignorePath = path.resolve(command.project.root, '.gitignore')
    try {
      const gitignoreContent = (await fs.readFile(gitignorePath)).toString()
      if (!gitignoreContent.includes('drizzle-dev.config.ts')) {
        await fs.writeFile(gitignorePath, `${gitignoreContent}\ndrizzle-dev.config.ts\n`, {
          flag: 'a',
        })
      }
    } catch {
      await fs.writeFile(gitignorePath, 'drizzle-dev.config.ts\n')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  packageJson.scripts = {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ...(packageJson.scripts ?? {}),
    ...packageJsonScripts,
  }
  if (opts.overwrite) {
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
  }

  type Answers = {
    updatePackageJson: boolean
    localDevBranch: boolean
  }
  const answers = await inquirer.prompt<Answers>([
    {
      type: 'confirm',
      name: 'localDevBranch',
      message: `Add a development database branch?`,
    },
  ])
  if (answers.localDevBranch) {
    console.log('cool')
    return
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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
  if (!Object.keys(packageJson?.devDependencies ?? {}).includes('drizzle-kit')) {
    await spawnAsync(command.project.packageManager?.installCommand ?? 'npm install', ['drizzle-kit@latest', '-D'], {
      stdio: 'inherit',
      shell: true,
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
  if (!Object.keys(packageJson?.dependencies ?? {}).includes('drizzle-orm')) {
    await spawnAsync(command.project.packageManager?.installCommand ?? 'npm install', ['drizzle-orm@latest'], {
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
    out: './migrations'
});`

const createDrizzleDevConfigContent = (devBranchUri: string) => `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'postgresql',
    dbCredentials: {
        url: '${devBranchUri}'
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

export const createDrizzleDevConfig = async (command: BaseCommand, opts: { devBranchUri: string }) => {
  if (!command.project.root) {
    throw new Error('Failed to initialize Drizzle in project. Project root not found.')
  }

  const drizzleDevConfigFilePath = path.resolve(command.project.root, 'drizzle-dev.config.ts')
  await carefullyWriteFile(
    drizzleDevConfigFilePath,
    createDrizzleDevConfigContent(opts.devBranchUri),
    command.project.root,
  )
}
