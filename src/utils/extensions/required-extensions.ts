import BaseCommand from '../../commands/base-command.js'
import {
  Extension,
  getExtension,
  //  getExtensionsMeta,
  getInstalledExtensionsForSite,
  installExtension,
} from './utils.js'

export async function handleRequiredExtensions(command: BaseCommand) {
  const requiredExtensions = await getRequiredExtensions(command)
  await installRequiredExtensions(command, requiredExtensions)
}

async function installRequiredExtensions(command: BaseCommand, requiredExtensions: (Extension | undefined)[]) {
  if (!command.netlify.api.accessToken || !command.netlify.siteInfo.account_id) {
    // skip installing extensions if not logged in
    return
  }
  const netlifyToken = command.netlify.api.accessToken.replace('Bearer ', '')
  const accountId = command.netlify.siteInfo.account_id

  for (const extension of requiredExtensions) {
    if (!extension) {
      continue
    }

    console.log(`Installing extension ${extension.name}...`)
    const installed = await installExtension({
      accountId: accountId,
      netlifyToken: netlifyToken,
      slug: extension.slug,
      hostSiteUrl: extension.hostSiteUrl,
    })
    if (installed) {
      console.log(`Installed extension ${extension.name}`)
    } else {
      console.warn(`Failed to install extension ${extension.name}`)
    }
  }
}

async function getRequiredExtensions(command: BaseCommand) {
  if (!command.netlify.api.accessToken || !command.netlify.siteInfo.account_id) {
    console.warn('Not logged in, skipping required extension handling')
    return []
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

  const requiredExtensions = await Promise.all(
    requiredExtensionsMeta.map((extMeta) =>
      getExtension({
        accountId: accountId,
        netlifyToken: netlifyToken,
        slug: extMeta.slug,
      }),
    ),
  )

  return requiredExtensions
}
