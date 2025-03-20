import fs from 'fs'
import path from 'path'
import { OptionValues } from 'commander'
import BaseCommand from '../base-command.js'

import openBrowser from '../../utils/open-browser.js'
import { getExtension, getExtensionInstallations, installExtension } from './utils.js'
import { getToken } from '../../utils/command-helpers.js'
import inquirer from 'inquirer'
import { NetlifyAPI } from 'netlify'
import { spawn } from 'child_process'

const NETLIFY_DATABASE_EXTENSION_SLUG = '-94w9m6w-netlify-database-extension'

const init = async (_options: OptionValues, command: BaseCommand) => {
  process.env.UNSTABLE_NETLIFY_DATABASE_EXTENSION_HOST_SITE_URL = 'http://localhost:8989'

  if (!command.siteId) {
    console.error(`The project must be linked with netlify link before initializing a database.`)
    return
  }

  const initialOpts = command.opts()

  const answers = await inquirer.prompt(
    [
      {
        type: 'confirm',
        name: 'drizzle',
        message: 'Use Drizzle?',
      },
    ].filter((q) => !initialOpts[q.name]),
  )

  if (!initialOpts.drizzle) {
    command.setOptionValue('drizzle', answers.drizzle)
  }
  const opts = command.opts()

  if (opts.drizzle && command.project.root) {
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

  let site: Awaited<ReturnType<typeof command.netlify.api.getSite>>
  try {
    // @ts-expect-error -- feature_flags is not in the types
    site = await command.netlify.api.getSite({ siteId: command.siteId, feature_flags: 'cli' })
  } catch (e) {
    console.error(`Error getting site, make sure you are logged in with netlify login`, e)
    return
  }
  if (!site.account_id) {
    console.error(`Error getting site, make sure you are logged in with netlify login`)
    return
  }
  if (!command.netlify.api.accessToken) {
    console.error(`You must be logged in with netlify login to initialize a database.`)
    return
  }

  const netlifyToken = command.netlify.api.accessToken.replace('Bearer ', '')

  const extension = await getExtension({
    accountId: site.account_id,
    token: netlifyToken,
    slug: NETLIFY_DATABASE_EXTENSION_SLUG,
  })

  if (!extension?.hostSiteUrl) {
    throw new Error(`Failed to get extension host site url when installing extension`)
  }

  const installations = await getExtensionInstallations({
    accountId: site.account_id,
    siteId: command.siteId,
    token: netlifyToken,
  })
  const dbExtensionInstallation = (
    installations as {
      integrationSlug: string
    }[]
  ).find((installation) => installation.integrationSlug === NETLIFY_DATABASE_EXTENSION_SLUG)

  if (!dbExtensionInstallation) {
    console.log(`Netlify Database extension not installed on team ${site.account_id}, attempting to install now...`)

    const installed = await installExtension({
      accountId: site.account_id,
      token: netlifyToken,
      slug: NETLIFY_DATABASE_EXTENSION_SLUG,
      hostSiteUrl: extension.hostSiteUrl ?? '',
    })
    if (!installed) {
      throw new Error(`Failed to install extension on team ${site.account_id}: ${NETLIFY_DATABASE_EXTENSION_SLUG}`)
    }
    console.log(`Netlify Database extension installed on team ${site.account_id}`)
  }

  try {
    const siteEnv = await command.netlify.api.getEnvVar({
      accountId: site.account_id,
      siteId: command.siteId,
      key: 'NETLIFY_DATABASE_URL',
    })

    if (siteEnv.key === 'NETLIFY_DATABASE_URL') {
      console.error(`Database already initialized for site: ${command.siteId}, skipping.`)
      return
    }
  } catch {
    // no op, env var does not exist, so we just continue
  }

  console.log('Initializing a new database for site:', command.siteId)

  const initEndpoint = new URL(
    '/cli-db-init',
    process.env.UNSTABLE_NETLIFY_DATABASE_EXTENSION_HOST_SITE_URL ?? extension.hostSiteUrl,
  ).toString()

  const req = await fetch(initEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${netlifyToken}`,
      'x-nf-db-site-id': command.siteId,
      'x-nf-db-account-id': site.account_id,
    },
  })

  const res = await req.json()
  console.log(res)
  return
}

export const createDatabaseCommand = (program: BaseCommand) => {
  const dbCommand = program.command('db').alias('database').description(`TODO: write description for database command`)

  dbCommand
    .command('init')
    .description('Initialize a new database')
    .option('--drizzle', 'Sets up drizzle-kit and drizzle-orm in your project')
    .action(init)

  dbCommand
    .command('drizzle-kit', 'TODO: write description for drizzle-kit command', {
      executableFile: path.resolve(program.workingDir, './node_modules/drizzle-kit/bin.cjs'),
    })
    .option('--open', 'when running drizzle-kit studio, open the browser to the studio url')
    .hook('preSubcommand', async (thisCommand, actionCommand) => {
      if (actionCommand.name() === 'drizzle-kit') {
        // @ts-expect-error thisCommand is not assignable to BaseCommand
        await drizzleKitPreAction(thisCommand) // set the NETLIFY_DATABASE_URL env var before drizzle-kit runs
      }
    })
    .allowUnknownOption() // allow unknown options to be passed through to drizzle-kit executable

  return dbCommand
}

const drizzleKitPreAction = async (thisCommand: BaseCommand) => {
  const opts = thisCommand.opts()
  const workingDir = thisCommand.workingDir
  const drizzleKitBinPath = path.resolve(workingDir, './node_modules/drizzle-kit/bin.cjs')
  try {
    fs.statSync(drizzleKitBinPath)
  } catch {
    console.error(`drizzle-kit not found in project's node modules, make sure you have installed drizzle-kit.`)
    return
  }

  const rawState = fs.readFileSync(path.resolve(workingDir, '.netlify/state.json'), 'utf8')
  const state = JSON.parse(rawState) as { siteId?: string } | undefined
  if (!state?.siteId) {
    throw new Error(`No site id found in .netlify/state.json`)
  }

  const [token] = await getToken()
  if (!token) {
    throw new Error(`No token found, please login with netlify login`)
  }
  const client = new NetlifyAPI(token)
  let site
  try {
    site = await client.getSite({ siteId: state.siteId })
  } catch {
    throw new Error(`No site found for site id ${state.siteId}`)
  }
  const accountId = site.account_id
  if (!accountId) {
    throw new Error(`No account id found for site ${state.siteId}`)
  }

  let netlifyDatabaseEnv
  try {
    netlifyDatabaseEnv = await client.getEnvVar({
      siteId: state.siteId,
      accountId,
      key: 'NETLIFY_DATABASE_URL',
    })
  } catch {
    throw new Error(
      `NETLIFY_DATABASE_URL environment variable not found on site ${state.siteId}. Run \`netlify db init\` first.`,
    )
  }

  const NETLIFY_DATABASE_URL = netlifyDatabaseEnv.values?.find(
    (val) => val.context === 'all' || val.context === 'dev',
  )?.value

  if (!NETLIFY_DATABASE_URL) {
    console.error(`NETLIFY_DATABASE_URL environment variable not found in project settings.`)
    return
  }

  if (typeof NETLIFY_DATABASE_URL === 'string') {
    process.env.NETLIFY_DATABASE_URL = NETLIFY_DATABASE_URL
    if (opts.open) {
      await openBrowser({ url: 'https://local.drizzle.studio/', silentBrowserNoneError: true })
    }
  }
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

const carefullyWriteFile = async (filePath: string, data: string) => {
  if (fs.existsSync(filePath)) {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Overwrite existing ${path.basename(filePath)}?`,
      },
    ])
    if (answers.overwrite) {
      fs.writeFileSync(filePath, data)
    }
  } else {
    fs.writeFileSync(filePath, data)
  }
}
