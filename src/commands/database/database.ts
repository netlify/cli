import { OptionValues } from 'commander'
import inquirer from 'inquirer'
import BaseCommand from '../base-command.js'
import { getAccount, getExtension, getSiteConfiguration, installExtension } from './utils.js'
import { initDrizzle } from './drizzle.js'
import { NEON_DATABASE_EXTENSION_SLUG } from './constants.js'
import prettyjson from 'prettyjson'
import { chalk, log } from '../../utils/command-helpers.js'

type SiteInfo = {
  id: string
  name: string
  account_id: string
  admin_url: string
  url: string
  ssl_url: string
}

const init = async (_options: OptionValues, command: BaseCommand) => {
  const siteInfo = command.netlify.siteInfo as SiteInfo
  if (!command.siteId) {
    console.error(`The project must be linked with netlify link before initializing a database.`)
    return
  }

  const initialOpts = command.opts()

  /**
   * Only prompt for drizzle if the user did not pass in the `--drizzle` or `--no-drizzle` option
   */
  if (initialOpts.drizzle !== false && initialOpts.drizzle !== true && !initialOpts.yes) {
    type Answers = {
      drizzle: boolean
    }
    const answers = await inquirer.prompt<Answers>([
      {
        type: 'confirm',
        name: 'drizzle',
        message: 'Use Drizzle?',
      },
    ])
    command.setOptionValue('drizzle', answers.drizzle)
  }

  const opts = command.opts<{
    drizzle?: boolean | undefined
    /**
     * Skip prompts and use default values (answer yes to all prompts)
     */
    yes?: true | undefined
  }>()

  if (opts.drizzle || (opts.yes && opts.drizzle !== false)) {
    await initDrizzle(command)
  }

  if (!command.netlify.api.accessToken) {
    throw new Error(`Please login with netlify login before running this command`)
  }

  // let site: Awaited<ReturnType<typeof command.netlify.api.getSite>>
  // try {
  //   site = await command.netlify.api.getSite({
  //     siteId: command.siteId,
  //     // @ts-expect-error -- feature_flags is not in the types
  //     feature_flags: 'cli',
  //   })
  // } catch (e) {
  //   throw new Error(`Error getting site, make sure you are logged in with netlify login`, {
  //     cause: e,
  //   })
  // }
  if (!siteInfo.account_id || !siteInfo.name) {
    throw new Error(`Error getting site, make sure you are logged in with netlify login`)
  }

  const account = await getAccount(command, { accountId: siteInfo.account_id })

  log(`Initializing a new database...`)

  const netlifyToken = command.netlify.api.accessToken.replace('Bearer ', '')
  const extension = await getExtension({
    accountId: siteInfo.account_id,
    token: netlifyToken,
    slug: NEON_DATABASE_EXTENSION_SLUG,
  })
  if (!extension?.hostSiteUrl) {
    throw new Error(`Failed to get extension host site url when installing extension`)
  }

  const installNeonExtension = async () => {
    if (!siteInfo.account_id || !account.name || !extension.name || !extension.hostSiteUrl) {
      throw new Error(`Failed to install extension "${extension.name}"`)
    }
    const installed = await installExtension({
      accountId: siteInfo.account_id,
      token: netlifyToken,
      slug: NEON_DATABASE_EXTENSION_SLUG,
      hostSiteUrl: extension.hostSiteUrl,
    })
    if (!installed) {
      throw new Error(`Failed to install extension on team "${account.name}": "${extension.name}"`)
    }
    log(`Extension "${extension.name}" successfully installed on team "${account.name}"`)
  }

  if (!extension.installedOnTeam && !opts.yes) {
    type Answers = {
      installExtension: boolean
    }
    const answers = await inquirer.prompt<Answers>([
      {
        type: 'confirm',
        name: 'installExtension',
        message: `The required extension "${extension.name}" is not installed on team "${account.name}", would you like to install it now?`,
      },
    ])
    if (answers.installExtension) {
      await installNeonExtension()
    } else {
      return
    }
  }
  if (!extension.installedOnTeam && opts.yes) {
    await installNeonExtension()
  }

  try {
    const siteEnv = await command.netlify.api.getEnvVar({
      accountId: siteInfo.account_id,
      siteId: command.siteId,
      key: 'NETLIFY_DATABASE_URL',
    })

    if (siteEnv.key === 'NETLIFY_DATABASE_URL') {
      log(`Environment variable "NETLIFY_DATABASE_URL" already exists on site: ${siteInfo.name}`)
      log(`You can run "netlify db status" to check the status for this site`)
      return
    }
  } catch {
    // no op, env var does not exist, so we just continue
  }

  const hostSiteUrl = process.env.NEON_DATABASE_EXTENSION_HOST_SITE_URL ?? extension.hostSiteUrl
  const initEndpoint = new URL('/cli-db-init', hostSiteUrl).toString()

  const req = await fetch(initEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'nf-db-token': netlifyToken,
      'nf-db-site-id': command.siteId,
      'nf-db-account-id': siteInfo.account_id,
    },
  })

  if (!req.ok) {
    throw new Error(`Failed to initialize DB: ${await req.text()}`)
  }

  const res = (await req.json()) as {
    code?: string
    message?: string
  }
  if (res.code === 'DATABASE_INITIALIZED') {
    if (res.message) {
      log(res.message)
    }

    log(
      prettyjson.render({
        'Current team': account.name,
        'Current site': siteInfo.name,
        [`${extension.name} extension`]: 'installed',
        Database: 'connected',
        'Site environment variable': 'NETLIFY_DATABASE_URL',
      }),
    )
  }
  return
}

const status = async (_options: OptionValues, command: BaseCommand) => {
  const siteInfo = command.netlify.siteInfo as SiteInfo
  if (!command.siteId) {
    throw new Error(`The project must be linked with netlify link before initializing a database.`)
  }
  if (!siteInfo.account_id) {
    throw new Error(`No account id found for site ${command.siteId}`)
  }
  if (!command.netlify.api.accessToken) {
    throw new Error(`You must be logged in with netlify login to check the status of the database`)
  }
  const netlifyToken = command.netlify.api.accessToken.replace('Bearer ', '')

  const account = await getAccount(command, { accountId: siteInfo.account_id })

  let siteEnv: Awaited<ReturnType<typeof command.netlify.api.getEnvVar>> | undefined
  try {
    siteEnv = await command.netlify.api.getEnvVar({
      accountId: siteInfo.account_id,
      siteId: command.siteId,
      key: 'NETLIFY_DATABASE_URL',
    })
  } catch {
    // no-op, env var does not exist, so we just continue
  }

  const extension = await getExtension({
    accountId: account.id,
    token: netlifyToken,
    slug: NEON_DATABASE_EXTENSION_SLUG,
  })
  let siteConfig
  try {
    siteConfig = await getSiteConfiguration({
      siteId: command.siteId,
      accountId: siteInfo.account_id,
      slug: NEON_DATABASE_EXTENSION_SLUG,
      token: netlifyToken,
    })
  } catch {
    // no-op, site config does not exist or extension not installed
  }

  log(
    prettyjson.render({
      'Current team': account.name,
      'Current site': siteInfo.name,
      [extension?.name ? `${extension.name} extension` : 'Database extension']: extension?.installedOnTeam
        ? 'installed'
        : chalk.red('not installed'),
      // @ts-expect-error -- siteConfig is not typed
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      Database: siteConfig?.config?.neonProjectId ? 'connected' : chalk.red('not connected'),
      'Site environment variable':
        siteEnv?.key === 'NETLIFY_DATABASE_URL' ? 'NETLIFY_DATABASE_URL' : chalk.red('NETLIFY_DATABASE_URL not set'),
    }),
  )
}

export const createDatabaseCommand = (program: BaseCommand) => {
  const dbCommand = program.command('db').alias('database').description(`TODO: write description for database command`)

  dbCommand
    .command('init')
    .description('Initialize a new database')
    .option('--drizzle', 'Sets up drizzle-kit and drizzle-orm in your project')
    .option('--no-drizzle', 'Skips drizzle')
    .option('-y, --yes', 'Skip prompts and use default values')
    .option('-o, --overwrite', 'Overwrites existing files that would be created when setting up drizzle')
    .action(init)

  dbCommand.command('status').description('Check the status of the database').action(status)

  return dbCommand
}
