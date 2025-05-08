import BaseCommand from '../../commands/base-command.js'
import { getAccount } from '../../commands/database/utils.js'
import {
  Extension,
  ExtensionMeta,
  getExtension,
  getAutoInstallableExtensions,
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

  const netlifyToken = command.netlify.api.accessToken.replace('Bearer ', '')
  const accountId = command.netlify.siteInfo.account_id
  const account = await getAccount(command, { accountId })

  const results = await Promise.all(
    requiredExtensions.map((extension) => {
      const meta = extensionsMeta.find((meta) => meta.slug === extension.slug)
      if (meta) {
        console.log(
          `Installing extension "${extension.name}" on team "${
            account.name
          }" required by package(s): "${meta.packages.join('",')}"`,
        )
      }
      return installExtension({
        accountId: accountId,
        netlifyToken: netlifyToken,
        slug: extension.slug,
        hostSiteUrl: extension.hostSiteUrl,
      })
    }),
  )

  results.forEach((install) => {
    const ext = requiredExtensions.find((ext) => ext.slug === install.slug)
    if (install.success) {
      console.log(`Installed${ext?.name ? ` "${ext.name}" ` : ' '}extension on team ${account.name}`)
    } else {
      console.warn(`Failed to install ${ext?.name ?? ''} extension on team ${account.name}`)
    }
  })
}

async function getRequiredExtensions(command: BaseCommand): Promise<[Extension[], ExtensionMeta[]]> {
  if (!command.netlify.api.accessToken || !command.netlify.siteInfo.account_id) {
    // skip installing extensions if not logged in
    return [[], []]
  }

  const netlifyToken = command.netlify.api.accessToken.replace('Bearer ', '')
  const accountId = command.netlify.siteInfo.account_id
  const siteId = command.netlify.siteInfo.id

  const [autoInstallableExtensions, packageJson, installedExtensions] = await Promise.all([
    getAutoInstallableExtensions(),
    command.project.getPackageJSON(),
    getInstalledExtensionsForSite({
      accountId: accountId,
      siteId: siteId,
      netlifyToken: netlifyToken,
    }),
  ])

  const autoInstallExtensions = autoInstallableExtensions.filter((extension) => {
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

  return [requiredExtensions as Extension[], autoInstallableExtensions]
}
