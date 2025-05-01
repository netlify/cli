import BaseCommand from '../base-command.js'
import { Extension, SiteInfo } from './database.js'
import { OptionValues } from 'commander'
import { getExtension } from './utils.js'
import { NEON_DATABASE_EXTENSION_SLUG } from './constants.js'
import { log } from 'console'
import inquirer from 'inquirer'
import prettyjson from 'prettyjson'
import { createDrizzleDevConfig } from './drizzle.js'

export const dev = async (_options: OptionValues, command: BaseCommand) => {
  const siteInfo = command.netlify.siteInfo as SiteInfo
  if (!command.siteId) {
    console.error(`The project must be linked with netlify link before setting up a local database.`)
    return
  }

  const netlifyToken = command.netlify.api.accessToken?.replace('Bearer ', '')
  if (!netlifyToken) {
    throw new Error(`Please login with netlify login before running this command`)
  }

  const extensionData = await getExtension({
    accountId: siteInfo.account_id,
    token: netlifyToken,
    slug: NEON_DATABASE_EXTENSION_SLUG,
  })

  const extension: Extension = extensionData
    ? {
        name: extensionData.name,
        hostSiteUrl: extensionData.hostSiteUrl,
        slug: NEON_DATABASE_EXTENSION_SLUG, // Add the slug from the parameter
        installedOnTeam: extensionData.installedOnTeam,
      }
    : (undefined as unknown as Extension)

  if (!extension.hostSiteUrl) {
    throw new Error(`Failed to get extension host site url`)
  }

  const headers = {
    'Content-Type': 'application/json',
    'nf-db-token': netlifyToken,
    'nf-db-site-id': command.siteId,
    'nf-db-account-id': siteInfo.account_id,
  }

  const initialOpts = command.opts()

  type Answers = {
    resetBranch: boolean
    createDevBranch: boolean
  }

  const { existingDevBranchName } = await getDevBranchInfo({ headers, command, extension })

  if ((!initialOpts.init || initialOpts.reset) && !existingDevBranchName) {
    log('No existing development branch found for this user and site')
    log('If you want to create one, run `netlify db dev --init`')
    return
  }

  if (initialOpts.init && existingDevBranchName) {
    log(`Development branch ${existingDevBranchName} already exists for this user and site`)
    return
  } else if (initialOpts.init) {
    const answers = await inquirer.prompt<Answers>([
      {
        type: 'confirm',
        name: 'createDevBranch',
        message: `Are you sure you want to create a new development branch for this user and site?`,
      },
    ])

    if (answers.createDevBranch) {
      const { uri, name } = await createDevBranch({ headers, command, extension })
      // if we can see that we are using drizzle, create the drizzle config
      await createDrizzleDevConfig(command, { devBranchUri: uri })
      log(`Created new development branch: ${name}`)
      return
    }
  }

  if (initialOpts.reset && !existingDevBranchName) {
    log('No existing development branch found for this user and site')
    log('If you want to create one, run `netlify db dev --init`')
    return
  }
  /**
   * If --reset was passed, prompt for confirmation that they want to reset their local branch
   */
  if (initialOpts.reset && existingDevBranchName) {
    const answers = await inquirer.prompt<Answers>([
      {
        type: 'confirm',
        name: 'resetBranch',
        message: `Are you sure you want to reset your current branch ${existingDevBranchName} to the current state of main?`,
      },
    ])

    if (answers.resetBranch) {
      const resetInfo = await reset({ headers, command, extension })
      log(prettyjson.render(resetInfo))
      return
    }
  }

  log(
    prettyjson.render({
      'Your dev branch': existingDevBranchName,
    }),
  )
  return
}

export const reset = async ({
  headers,
  command,
  extension,
}: {
  headers: Record<string, string>
  command: BaseCommand
  extension: Extension
}) => {
  const hostSiteUrl = getHostSiteUrl(command, extension)
  const devBranchResetEndpoint = new URL('/reset-dev-branch', hostSiteUrl).toString()
  const req = await fetch(devBranchResetEndpoint, {
    method: 'POST',
    headers,
  })

  if (!req.ok) {
    throw new Error(`Failed to reset database: ${await req.text()}`)
  }
  const res = await req.json()
  return res
}

export const createDevBranch = async ({
  headers,
  command,
  extension,
}: {
  headers: Record<string, string>
  command: BaseCommand
  extension: Extension
}) => {
  const hostSiteUrl = getHostSiteUrl(command, extension)
  const devBranchInfoEndpoint = new URL('/create-dev-branch', hostSiteUrl).toString()

  const req = await fetch(devBranchInfoEndpoint, {
    method: 'POST',
    headers,
  })

  if (!req.ok) {
    throw new Error(`Failed to create dev branch: ${await req.text()}`)
  }
  const res = await req.json()
  const { uri, name } = res as { uri: string; name: string }

  return { uri, name }
}

export const getDevBranchInfo = async ({
  headers,
  command,
  extension,
}: {
  headers: Record<string, string>
  command: BaseCommand
  extension: Extension
}) => {
  const hostSiteUrl = getHostSiteUrl(command, extension)
  const devBranchInfoEndpoint = new URL('/get-dev-branch', hostSiteUrl).toString()

  const req = await fetch(devBranchInfoEndpoint, {
    method: 'GET',
    headers,
  })

  if (!req.ok) {
    throw new Error(`Failed to get database information: ${await req.text()}`)
  }
  const res = (await req.json()) as { localDevBranch: { name: string } | null }

  if (!res.localDevBranch) {
    return { existingDevBranchName: undefined }
  }
  const {
    localDevBranch: { name: existingDevBranchName },
  } = res

  return { existingDevBranchName }
}

const getHostSiteUrl = (command: BaseCommand, extension: Extension) => {
  const {
    // @ts-expect-error types are weird here
    build_settings: { env: siteEnv = {} },
  } = command.netlify.siteInfo
  const NEON_DATABASE_EXTENSION_HOST_SITE_URL = (siteEnv as Record<string, unknown>)
    .NEON_DATABASE_EXTENSION_HOST_SITE_URL as string | undefined
  return NEON_DATABASE_EXTENSION_HOST_SITE_URL ?? extension.hostSiteUrl
}
