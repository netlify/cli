// @ts-check


const { ADDON_VALIDATION, prepareAddonCommand } = require('../../utils/addons/prepare.mjs')

const { exit, log, openBrowser } = require('../../utils/index.mjs')

/**
 * The addons:auth command
 * @param {string} addonName
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */

const addonsAuth = async (addonName: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
  const { addon } = await prepareAddonCommand({
    command,
    addonName,
    validation: ADDON_VALIDATION.EXISTS,
  })

  if (!addon.auth_url) {
    log(`No Admin URL found for the "${addonName} add-on"`)
    return false
  }

  log()
  log(`Opening ${addonName} add-on admin URL:`)
  log()
  log(addon.auth_url)
  log()
  await openBrowser({ url: addon.auth_url })
  exit()
}

/**
 * Creates the `netlify addons:auth` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

const createAddonsAuthCommand = (program: $TSFixMe) => program
  .command('addons:auth')
  .alias('addon:auth')
  .argument('<name>', 'Add-on slug')
  .description('Login to add-on provider')
  
  .action(async (addonName: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
    await addonsAuth(addonName, options, command)
  })

export default { createAddonsAuthCommand }
