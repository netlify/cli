// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'Listr'.
const Listr = require('listr')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
const { error, execa } = require('../../utils/index.mjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'installPla... Remove this comment to see the full error message
const { installPlatform } = require('../../utils/lm/install.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'checkHelpe... Remove this comment to see the full error message
const { checkHelperVersion } = require('../../utils/lm/requirements.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'printBanne... Remove this comment to see the full error message
const { printBanner } = require('../../utils/lm/ui.cjs')

const installHelperIfMissing = async function ({
  force
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
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

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const provisionService = async function (siteId: $TSFixMe, api: $TSFixMe) {
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
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
throw new Error((error_ as $TSFixMe).json.error);
  }
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const configureLFSURL = async function (siteId: $TSFixMe, api: $TSFixMe) {
  const siteInfo = await api.getSite({ siteId })
  const url = `https://${siteInfo.id_domain}/.netlify/large-media`

  return execa('git', ['config', '-f', '.lfsconfig', 'lfs.url', url])
}

/**
 * The lm:setup command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const lmSetup = async (options: $TSFixMe, command: $TSFixMe) => {
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
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLmSe... Remove this comment to see the full error message
const createLmSetupCommand = (program: $TSFixMe) => program
  .command('lm:setup')
  .description('Configures your site to use Netlify Large Media')
  .option('-s, --skip-install', 'Skip the credentials helper installation check')
  .option('-f, --force-install', 'Force the credentials helper installation')
  .addHelpText('after', 'It runs the install command if you have not installed the dependencies yet.')
  .action(lmSetup)

module.exports = { createLmSetupCommand }
