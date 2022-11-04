// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'inquirer'.
const inquirer = require('inquirer')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'ADDON_VALI... Remove this comment to see the full error message
const { ADDON_VALIDATION, prepareAddonCommand } = require('../../utils/addons/prepare.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
const { error, exit, log } = require('../../utils/index.mjs')

/**
 * The addons:delete command
 * @param {string} addonName
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const addonsDelete = async (addonName: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
  const { addon } = await prepareAddonCommand({
    command,
    addonName,
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
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    error((error_ as $TSFixMe).message);
  }
}

/**
 * Creates the `netlify addons:delete` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createAddo... Remove this comment to see the full error message
const createAddonsDeleteCommand = (program: $TSFixMe) => program
  .command('addons:delete')
  .alias('addon:delete')
  .argument('<name>', 'Add-on namespace')
  .description(
    `Remove an add-on extension to your site\nAdd-ons are a way to extend the functionality of your Netlify site`,
  )
  .option('-f, --force', 'delete without prompting (useful for CI)')
  .action(addonsDelete)

module.exports = { createAddonsDeleteCommand }
