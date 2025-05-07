import { OptionValues } from 'commander'
import inquirer from 'inquirer'
import BaseCommand from '../base-command.js'
import { getAccount } from './utils.js'
import { initDrizzle } from './drizzle.js'
import prettyjson from 'prettyjson'
import { log } from '../../utils/command-helpers.js'
import { SiteInfo } from './database.js'
import { NEON_DATABASE_EXTENSION_SLUG } from '../../utils/extensions/constants.js'
import { getExtension, getJigsawToken, installExtension } from '../../utils/extensions/utils.js'

export const init = async (_options: OptionValues, command: BaseCommand) => {
  const siteInfo = command.netlify.siteInfo as SiteInfo
  if (!command.siteId) {
    console.error(`The project must be linked with netlify link before initializing a database.`)
    return
  }

  const initialOpts = command.opts()

  const opts = command.opts<{
    drizzle?: boolean | undefined
    overwrite?: boolean | undefined
    minimal?: boolean | undefined
  }>()

  if (!command.netlify.api.accessToken || !siteInfo.account_id || !siteInfo.name) {
    throw new Error(`Please login with netlify login before running this command`)
  }

  if (opts.minimal === true) {
    command.setOptionValue('drizzle', false)
  }

  const account = await getAccount(command, { accountId: siteInfo.account_id })

  const netlifyToken = command.netlify.api.accessToken.replace('Bearer ', '')

  const extension = await getExtension({
    accountId: siteInfo.account_id,
    netlifyToken: netlifyToken,
    slug: NEON_DATABASE_EXTENSION_SLUG,
  })
  if (!extension?.hostSiteUrl) {
    throw new Error(`Failed to get extension host site url when installing extension`)
  }

  const installNeonExtension = async () => {
    if (!account.name) {
      throw new Error(`Failed to install extension "${extension.name}"`)
    }
    const installed = await installExtension({
      accountId: siteInfo.account_id,
      netlifyToken: netlifyToken,
      slug: NEON_DATABASE_EXTENSION_SLUG,
      hostSiteUrl: extension.hostSiteUrl,
    })
    if (!installed.success) {
      throw new Error(`Failed to install extension on team "${account.name}": "${extension.name}"`)
    }
    log(`Extension "${extension.name}" successfully installed on team "${account.name}"`)
  }

  if (!extension.installedOnTeam) {
    await installNeonExtension()
  }

  /**
   * Only prompt for drizzle if the user did not pass in the `--drizzle` or `--no-drizzle` option
   */
  if (initialOpts.drizzle !== false && initialOpts.drizzle !== true) {
    const answers = await inquirer.prompt<{
      drizzle: boolean
    }>([
      {
        type: 'confirm',
        name: 'drizzle',
        message: 'Use Drizzle?',
      },
    ])
    command.setOptionValue('drizzle', answers.drizzle)
  }
  if (opts.drizzle) {
    log(`Initializing drizzle...`)
    await initDrizzle(command)
  }

  log(`Initializing a new database...`)
  const hostSiteUrl = process.env.EXTENSION_HOST_SITE_URL ?? extension.hostSiteUrl
  const initEndpoint = new URL('/api/cli-db-init', hostSiteUrl).toString()
  const currentUser = await command.netlify.api.getCurrentUser()

  const { data: jigsawToken, error } = await getJigsawToken({
    netlifyToken: netlifyToken,
    accountId: siteInfo.account_id,
    integrationSlug: extension.slug,
  })
  if (error || !jigsawToken) {
    throw new Error(`Failed to get jigsaw token: ${error?.message ?? 'Unknown error'}`)
  }

  const headers = {
    'Content-Type': 'application/json',
    'Nf-UIExt-Netlify-Token': jigsawToken,
    'Nf-UIExt-Netlify-Token-Issuer': 'jigsaw',
    'Nf-UIExt-Extension-Id': extension.id,
    'Nf-UIExt-Extension-Slug': extension.slug,
    'Nf-UIExt-Site-Id': command.siteId ?? '',
    'Nf-UIExt-Team-Id': siteInfo.account_id,
    'Nf-UIExt-User-Id': currentUser.id ?? '',
  }
  const req = await fetch(initEndpoint, {
    method: 'POST',
    headers,
  })

  if (!req.ok) {
    const error = (await req.json()) as {
      code?: string
      message?: string
    }
    if (error.code === 'CONFLICT') {
      log(`Database already connected to this site. Skipping initialization.`)
    } else {
      throw new Error(`Failed to initialize DB: ${error.message ?? 'Unknown error occurred'}`)
    }
  }

  let status

  try {
    const statusEndpoint = new URL('/api/cli-db-status', hostSiteUrl).toString()
    const statusRes = await fetch(statusEndpoint, {
      headers,
    })
    if (!statusRes.ok) {
      throw new Error(`Failed to get database status`, { cause: statusRes })
    }
    status = (await statusRes.json()) as {
      siteConfiguration?: {
        connectedDatabase?: {
          isConnected: boolean
        }
      }
      existingManagedEnvs?: string[]
    }
  } catch (e) {
    console.error('Failed to get database status', e)
  }

  log(
    prettyjson.render({
      'Current team': account.name,
      'Current site': siteInfo.name,
      [`${extension.name} extension`]: 'installed on team',
      ['Database status']: status?.siteConfiguration?.connectedDatabase?.isConnected
        ? 'connected to site'
        : 'not connected',
      ['Environment variables']: '',
      ['  NETLIFY_DATABASE_URL']: status?.existingManagedEnvs?.includes('NETLIFY_DATABASE_URL') ? 'saved' : 'not set',
      ['  NETLIFY_DATABASE_URL_UNPOOLED']: status?.existingManagedEnvs?.includes('NETLIFY_DATABASE_URL_UNPOOLED')
        ? 'saved'
        : 'not set',
    }),
  )
  return
}
