// @ts-check
import Listr from 'listr'

import { error } from '../../utils/command-helpers.mjs'
import execa from '../../utils/execa.mjs'
import { installPlatform } from '../../utils/lm/install.mjs'
import { checkHelperVersion } from '../../utils/lm/requirements.mjs'
import { printBanner } from '../../utils/lm/ui.mjs'

const installHelperIfMissing = async function ({ force }) {
  let installHelper = false
  try {
    const version = await checkHelperVersion()
    if (!version) {
      installHelper = true
    }
  } catch {
    installHelper = true
  }

  if (installHelper) {
    return installPlatform({ force })
  }

  return false
}

const provisionService = async function (siteId, api) {
  const addonName = 'large-media'

  if (!siteId) {
    throw new Error('No site id found, please run inside a site folder or `netlify link`')
  }
  try {
    await api.createServiceInstance({
      siteId,
      addon: addonName,
      body: {},
    })
  } catch (error_) {
    // error is JSONHTTPError
    throw new Error(error_.json.error)
  }
}

const configureLFSURL = async function (siteId, api) {
  const siteInfo = await api.getSite({ siteId })
  const url = `https://${siteInfo.id_domain}/.netlify/large-media`

  return execa('git', ['config', '-f', '.lfsconfig', 'lfs.url', url])
}

/**
 * The lm:setup command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const lmSetup = async (options, command) => {
  await command.authenticate()

  const { api, site } = command.netlify

  let helperInstalled = false
  if (!options.skipInstall) {
    try {
      helperInstalled = await installHelperIfMissing({ force: options.forceInstall })
    } catch (error_) {
      error(error_)
    }
  }

  const tasks = new Listr([
    {
      title: 'Provisioning Netlify Large Media',
      async task() {
        await provisionService(site.id, api)
      },
    },
    {
      title: 'Configuring Git LFS for this site',
      async task() {
        await configureLFSURL(site.id, api)
      },
    },
  ])
  await tasks.run().catch(() => {})

  if (helperInstalled) {
    printBanner(options.forceInstall)
  }
}

/**
 * Creates the `netlify lm:setup` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createLmSetupCommand = (program) =>
  program
    .command('lm:setup')
    .description('Configures your site to use Netlify Large Media')
    .option('-s, --skip-install', 'Skip the credentials helper installation check')
    .option('-f, --force-install', 'Force the credentials helper installation')
    .addHelpText('after', 'It runs the install command if you have not installed the dependencies yet.')
    .action(lmSetup)
