import BaseCommand from '../../commands/base-command.js'
import { getAccount } from '../../commands/database/utils.js'
import {
  Extension,
  ExtensionMeta,
  getExtension,
  //  getExtensionsMeta,
  getInstalledExtensionsForSite,
  installExtension,
} from './utils.js'

export async function installRequiredExtensions(command: BaseCommand) {
  if (!command.netlify.api.accessToken || !command.netlify.siteInfo.account_id) {
    // skip installing extensions if not logged in
    return
  }
  const [requiredExtensions, extensionsMeta] = await getRequiredExtensions(command)

  if (requiredExtensions.length === 0) {
    return
  }
  console.log(`Detected package(s) that require extension(s) to be installed on your team.`)

  const netlifyToken = command.netlify.api.accessToken.replace('Bearer ', '')
  const accountId = command.netlify.siteInfo.account_id
  const account = await getAccount(command, { accountId })

  for (const extension of requiredExtensions) {
    const meta = extensionsMeta.find((meta) => meta.slug === extension.slug)
    if (meta) {
      console.log(`Extension: "${extension.name}" required by "${meta.packages.join('",')}"`)
    }
    const installed = await installExtension({
      accountId: accountId,
      netlifyToken: netlifyToken,
      slug: extension.slug,
      hostSiteUrl: extension.hostSiteUrl,
    })
    if (installed) {
      console.log(`Installed ${extension.name} extension on team ${account.name}`)
    } else {
      console.warn(`Failed to install ${extension.name} extension on team ${account.name}`)
    }
  }
}

async function getRequiredExtensions(command: BaseCommand): Promise<[Extension[], ExtensionMeta[]]> {
  if (!command.netlify.api.accessToken || !command.netlify.siteInfo.account_id) {
    // skip installing extensions if not logged in
    return [[], []]
  }

  const netlifyToken = command.netlify.api.accessToken.replace('Bearer ', '')
  const accountId = command.netlify.siteInfo.account_id
  const siteId = command.netlify.siteInfo.id

  const extensionsMeta = [{ slug: 'neon', packages: ['@netlify/neon'] }]
  const [
    // extensionsMeta,
    packageJson,
    installedExtensions,
  ] = await Promise.all([
    // getExtensionsMeta(), // todo: uncomment when jigsaw /meta endpoint is deployed
    command.project.getPackageJSON(),
    getInstalledExtensionsForSite({
      accountId: accountId,
      siteId: siteId,
      netlifyToken: netlifyToken,
    }),
  ])

  const autoInstallExtensions = extensionsMeta.filter((extension) => {
    return extension.packages.some((pkg) => {
      return packageJson.dependencies?.[pkg]
    })
  })

  const requiredExtensionsMeta = autoInstallExtensions.filter((extension) => {
    return !installedExtensions.find((installedExtension) => installedExtension.integrationSlug === extension.slug)
  })

  const requiredExtensions = (
    await Promise.all(
      requiredExtensionsMeta.map((extMeta) =>
        getExtension({
          accountId: accountId,
          netlifyToken: netlifyToken,
          slug: extMeta.slug,
        }),
      ),
    )
  ).filter(Boolean)

  return [requiredExtensions as Extension[], extensionsMeta]
}
