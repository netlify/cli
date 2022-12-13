// @ts-check
import AsciiTable from 'ascii-table'

import { prepareAddonCommand } from '../../utils/addons/prepare.mjs'
import { log, logJson } from '../../utils/command-helpers.mjs'

/**
 * The addons:list command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 * @returns {Promise<boolean>}
 */
const addonsList = async (options, command) => {
  const { addons, siteData } = await prepareAddonCommand({ command })
  // Return json response for piping commands
  if (options.json) {
    logJson(addons)
    return false
  }

  if (!addons || addons.length === 0) {
    log(`No addons currently installed for ${siteData.name}`)
    log(`> Run \`netlify addons:create addon-namespace\` to install an addon`)
    return false
  }

  const addonData = addons.map((addon) => ({
    namespace: addon.service_path.replace('/.netlify/', ''),
    name: addon.service_name,
    id: addon.id,
  }))

  // Build a table out of addons
  log(`site: ${siteData.name}`)
  const table = new AsciiTable(`Currently Installed addons`)

  table.setHeading('NameSpace', 'Name', 'Instance Id')

  addonData.forEach(({ id, name, namespace }) => {
    table.addRow(namespace, name, id)
  })
  // Log da addons
  log(table.toString())
}

/**
 * Creates the `netlify addons:list` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createAddonsListCommand = (program) =>
  program
    .command('addons:list')
    .alias('addon:list')
    .description(`List currently installed add-ons for site`)
    .option('--json', 'Output add-on data as JSON')
    .action(async (options, command) => {
      await addonsList(options, command)
    })
