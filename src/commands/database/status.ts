import { OptionValues } from 'commander'
import { SiteInfo } from './database.js'
import BaseCommand from '../base-command.js'
import { getAccount, getExtension, getSiteConfiguration } from './utils.js'
import { NEON_DATABASE_EXTENSION_SLUG } from './constants.js'
import prettyjson from 'prettyjson'
import { chalk, log } from '../../utils/command-helpers.js'

export const status = async (_options: OptionValues, command: BaseCommand) => {
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
