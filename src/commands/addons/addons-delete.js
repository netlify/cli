// @ts-check
const inquirer = require('inquirer')

const { error, exit, log } = require('../../utils')
const { ADDON_VALIDATION, prepareAddonCommand } = require('../../utils/addons/prepare')

/**
 * The addons:delete command
 * @param {string} addonName
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const addonsDelete = async (addonName, options, command) => {
  const { addon } = await prepareAddonCommand({
    command,
    addonName,
    // @ts-ignore.
    validation: ADDON_VALIDATION.EXISTS,
  })
  if (!options.force && !options.f) {
    const { wantsToDelete } = await inquirer.prompt({
      type: 'confirm',
      name: 'wantsToDelete',
      message: `Are you sure you want to delete the ${addonName} add-on? (to skip this prompt, pass a --force flag)`,
      default: false,
    })
    if (!wantsToDelete) {
      exit()
    }
  }

  try {
    await command.netlify.api.deleteServiceInstance({
      siteId: command.netlify.site.id,
      addon: addonName,
      instanceId: addon.id,
    })
    log(`Addon "${addonName}" deleted`)
  } catch (error_) {
    error(error_.message)
  }
}

/**
 * Creates the `netlify addons:delete` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createAddonsDeleteCommand = (program) =>
  program
    .command('addons:delete')
    .alias('addon:delete')
    .argument('<name>', 'Add-on namespace')
    .description(
      `Remove an add-on extension to your site\nAdd-ons are a way to extend the functionality of your Netlify site`,
    )
    .option('-f, --force', 'delete without prompting (useful for CI)')
    .action(addonsDelete)

module.exports = { createAddonsDeleteCommand }
