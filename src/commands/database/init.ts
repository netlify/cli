import { OptionValues } from 'commander'
import inquirer from 'inquirer'
import BaseCommand from '../base-command.js'
import { getAccount, getExtension, getJigsawToken, installExtension } from './utils.js'
import { initDrizzle } from './drizzle.js'
import { NEON_DATABASE_EXTENSION_SLUG } from './constants.js'
import prettyjson from 'prettyjson'
import { log } from '../../utils/command-helpers.js'
import { SiteInfo } from './database.js'

export const init = async (_options: OptionValues, command: BaseCommand) => {
  const siteInfo = command.netlify.siteInfo as SiteInfo
  if (!command.siteId) {
    console.error(`The project must be linked with netlify link before initializing a database.`)
    return
  }

  const initialOpts = command.opts()

  type Answers = {
    drizzle: boolean
    installExtension: boolean
  }

  const opts = command.opts<{
    drizzle?: boolean | undefined
    /**
     * Skip prompts and use default values (answer yes to all prompts)
     */
    yes?: true | undefined
  }>()

  if (!command.netlify.api.accessToken || !siteInfo.account_id || !siteInfo.name) {
    throw new Error(`Please login with netlify login before running this command`)
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
    if (!installed) {
      throw new Error(`Failed to install extension on team "${account.name}": "${extension.name}"`)
    }
    log(`Extension "${extension.name}" successfully installed on team "${account.name}"`)
  }

  if (!extension.installedOnTeam && !opts.yes) {
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
  /**
   * Only prompt for drizzle if the user did not pass in the `--drizzle` or `--no-drizzle` option
   */
  if (initialOpts.drizzle !== false && initialOpts.drizzle !== true && !initialOpts.yes) {
    const answers = await inquirer.prompt<Answers>([
      {
        type: 'confirm',
        name: 'drizzle',
        message: 'Use Drizzle?',
      },
    ])
    command.setOptionValue('drizzle', answers.drizzle)
  }

  if (opts.drizzle || (opts.yes && opts.drizzle !== false)) {
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
    throw new Error(`Failed to initialize DB: ${error.message ?? 'Unknown error occurred'}`)
  }

  const res = (await req.json()) as {
    code?: string
    message?: string
  }

  if (res.code !== 'DATABASE_INITIALIZED') {
    throw new Error(`Failed to initialize DB: ${res.message ?? 'Unknown error'}`)
  }

  log(
    prettyjson.render({
      'Current team': account.name,
      'Current site': siteInfo.name,
      [`${extension.name} extension`]: 'installed on team',
      ['Database status']: 'connected to site',
      ['Environment variables']: '',
      ['  NETLIFY_DATABASE_URL']: 'saved',
      ['  NETLIFY_DATABASE_URL_UNPOOLED']: 'saved',
    }),
  )
  return
}
