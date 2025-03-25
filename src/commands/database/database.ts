import { OptionValues } from 'commander'
import inquirer from 'inquirer'
import BaseCommand from '../base-command.js'
import { getExtension, getExtensionInstallations, getSiteConfiguration, installExtension } from './utils.js'
import { initDrizzle } from './drizzle.js'

const NETLIFY_DATABASE_EXTENSION_SLUG = '7jjmnqyo-netlify-neon'

const init = async (_options: OptionValues, command: BaseCommand) => {
  if (!command.siteId) {
    console.error(`The project must be linked with netlify link before initializing a database.`)
    return
  }

  const initialOpts = command.opts()

  if (initialOpts.drizzle !== false) {
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
  // console.log('site', site)
  if (!site.account_id) {
    throw new Error(`No account id found for site ${command.siteId}`)
  }

  console.log(`Initializing a new database for site: ${command.siteId} on account ${site.account_id}
    Please wait...`)

  const netlifyToken = command.netlify.api.accessToken.replace('Bearer ', '')
  const extension = await getExtension({
    accountId: site.account_id,
    token: netlifyToken,
    slug: NETLIFY_DATABASE_EXTENSION_SLUG,
  })

  if (!extension?.hostSiteUrl) {
    throw new Error(`Failed to get extension host site url when installing extension`)
  }

  if (!extension.installedOnTeam) {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'installExtension',
        message: `Netlify Database extension is not installed on team ${site.account_id}, would you like to install it now?`,
      },
    ])
    if (answers.installExtension) {
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
    } else {
      return
    }
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

  const extensionSiteUrl = process.env.UNSTABLE_NETLIFY_DATABASE_EXTENSION_HOST_SITE_URL ?? extension.hostSiteUrl

  const initEndpoint = new URL('/cli-db-init', extensionSiteUrl).toString()
  console.log('initEndpoint', initEndpoint)
  const req = await fetch(initEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'nf-db-token': netlifyToken,
      'nf-db-site-id': command.siteId,
      'nf-db-account-id': site.account_id,
    },
  })

  if (!req.ok) {
    throw new Error(`Failed to initialize DB: ${await req.text()}`)
  }

  const res = await req.json()
  console.log(res)
  return
}

const status = async (_options: OptionValues, command: BaseCommand) => {
  if (!command.siteId) {
    console.error(`The project must be linked with netlify link before initializing a database.`)
    return
  }
  // check if this site has a db initialized
  const site = await command.netlify.api.getSite({ siteId: command.siteId })
  if (!site.account_id) {
    throw new Error(`No account id found for site ${command.siteId}`)
  }
  if (!command.netlify.api.accessToken) {
    throw new Error(`You must be logged in with netlify login to check the status of the database`)
  }
  const netlifyToken = command.netlify.api.accessToken.replace('Bearer ', '')
  const extensionInstallation = await getExtensionInstallations({
    accountId: site.account_id,
    siteId: command.siteId,
    token: netlifyToken,
  })

  if (!extensionInstallation) {
    console.log(`Netlify Database extension not installed on team ${site.account_id}`)
    return
  }

  const siteConfig = await getSiteConfiguration({
    siteId: command.siteId,
    accountId: site.account_id,
    slug: NETLIFY_DATABASE_EXTENSION_SLUG,
    token: netlifyToken,
  })

  if (!siteConfig) {
    throw new Error(`Failed to get site configuration for site ${command.siteId}`)
  }
  try {
    const siteEnv = await command.netlify.api.getEnvVar({
      accountId: site.account_id,
      siteId: command.siteId,
      key: 'NETLIFY_DATABASE_URL',
    })

    if (siteEnv.key === 'NETLIFY_DATABASE_URL') {
      console.log(`Database initialized for site: ${command.siteId}`)
      return
    }
  } catch {
    throw new Error(
      `Database not initialized for site: ${command.siteId}.
Run 'netlify db init' to initialize a database`,
    )
  }
}

export const createDatabaseCommand = (program: BaseCommand) => {
  const dbCommand = program.command('db').alias('database').description(`TODO: write description for database command`)

  dbCommand
    .command('init')
    .description('Initialize a new database')
    .option('--drizzle', 'Sets up drizzle-kit and drizzle-orm in your project')
    .option('--no-drizzle', 'Skips drizzle')
    .action(init)

  dbCommand.command('status').description('Check the status of the database').action(status)

  return dbCommand
}
