import { OptionValues } from 'commander'
import inquirer from 'inquirer'
import BaseCommand from '../base-command.js'
import { getExtension, getExtensionInstallations, installExtension } from './utils.js'
import { initDrizzle } from './drizzle.js'

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
    await initDrizzle(command)
  }

  if (!command.netlify.api.accessToken) {
    throw new Error(`No access token found, please login with netlify login`)
  }

  let site: Awaited<ReturnType<typeof command.netlify.api.getSite>>
  try {
    // @ts-expect-error -- feature_flags is not in the types
    site = await command.netlify.api.getSite({ siteId: command.siteId, feature_flags: 'cli' })
  } catch (e) {
    throw new Error(`Error getting site, make sure you are logged in with netlify login`, {
      cause: e,
    })
  }
  if (!site.account_id) {
    throw new Error(`No account id found for site ${command.siteId}`)
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
      console.error(`Database already initialized for site: ${command.siteId}`)
      return
    }
  } catch {
    // no op, env var does not exist, so we just continue
  }

  console.log('Initializing a new database for site: ', command.siteId)

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

  return dbCommand
}
