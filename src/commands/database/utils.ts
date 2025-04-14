import fsPromises from 'fs/promises'
import fs from 'fs'
import inquirer from 'inquirer'

import { JIGSAW_URL, NETLIFY_WEB_UI } from './constants.js'
import BaseCommand from '../base-command.js'
import { Extension } from './database.js'

export const getExtension = async ({ accountId, token, slug }: { accountId: string; token: string; slug: string }) => {
  const url = new URL('/.netlify/functions/fetch-extension', NETLIFY_WEB_UI)
  url.searchParams.append('teamId', accountId)
  url.searchParams.append('slug', slug)

  const extensionReq = await fetch(url.toString(), {
    headers: {
      Cookie: `_nf-auth=${token}`,
    },
  })
  const extension = (await extensionReq.json()) as Extension | undefined

  return extension
}

export const installExtension = async ({
  token,
  accountId,
  slug,
  hostSiteUrl,
}: {
  token: string
  accountId: string
  slug: string
  hostSiteUrl: string
}) => {
  const url = new URL('/.netlify/functions/install-extension', NETLIFY_WEB_UI)
  const installExtensionResponse = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `_nf-auth=${token}`,
    },
    body: JSON.stringify({
      teamId: accountId,
      slug,
      hostSiteUrl,
    }),
  })

  if (!installExtensionResponse.ok) {
    throw new Error(`Failed to install extension: ${slug}`)
  }

  const installExtensionData = await installExtensionResponse.json()
  return installExtensionData
}

export const getSiteConfiguration = async ({
  siteId,
  accountId,
  token,
  slug,
}: {
  siteId: string
  accountId: string
  token: string
  slug: string
}) => {
  const url = new URL(`/team/${accountId}/integrations/${slug}/configuration/site/${siteId}`, JIGSAW_URL)
  const siteConfigurationResponse = await fetch(url.toString(), {
    headers: {
      'netlify-token': token,
    },
  })
  if (!siteConfigurationResponse.ok) {
    throw new Error(`Failed to fetch extension site configuration for ${siteId}. Is the extension installed?`)
  }

  const siteConfiguration = await siteConfigurationResponse.json()
  return siteConfiguration
}

export const carefullyWriteFile = async (filePath: string, data: string, projectRoot: string) => {
  if (fs.existsSync(filePath)) {
    type Answers = {
      overwrite: boolean
    }
    const answers = await inquirer.prompt<Answers>([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Overwrite existing file .${filePath.replace(projectRoot, '')}?`,
      },
    ])
    if (answers.overwrite) {
      await fsPromises.writeFile(filePath, data)
    }
  } else {
    await fsPromises.writeFile(filePath, data)
  }
}

export const getAccount = async (
  command: BaseCommand,
  {
    accountId,
  }: {
    accountId: string
  },
) => {
  let account: Awaited<ReturnType<typeof command.netlify.api.getAccount>>[number]
  try {
    // @ts-expect-error -- TODO: fix the getAccount type in the openapi spec. It should not be an array of accounts, just one account.
    account = await command.netlify.api.getAccount({ accountId })
  } catch (e) {
    throw new Error(`Error getting account, make sure you are logged in with netlify login`, {
      cause: e,
    })
  }
  if (!account.id || !account.name) {
    throw new Error(`Error getting account, make sure you are logged in with netlify login`)
  }
  return account as { id: string; name: string } & Omit<
    Awaited<ReturnType<typeof command.netlify.api.getAccount>>[number],
    'id' | 'name'
  >
}
