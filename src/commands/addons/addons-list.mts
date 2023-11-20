import AsciiTable from 'ascii-table'

import { prepareAddonCommand } from '../../utils/addons/prepare.mjs'
import { log, logJson } from '../../utils/command-helpers.mjs'

/**
 * The addons:list command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 * @returns {Promise<boolean>}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const addonsList = async (options, command) => {
  // @ts-expect-error TS(2345) FIXME: Argument of type '{ command: any; }' is not assign... Remove this comment to see the full error message
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

  // @ts-expect-error TS(7006) FIXME: Parameter 'addon' implicitly has an 'any' type.
  const addonData = addons.map((addon) => ({
    namespace: addon.service_path.replace('/.netlify/', ''),
    name: addon.service_name,
    id: addon.id,
  }))

  // Build a table out of addons
  log(`site: ${siteData.name}`)
  const table = new AsciiTable(`Currently Installed addons`)

  table.setHeading('NameSpace', 'Name', 'Instance Id')

  // @ts-expect-error TS(7031) FIXME: Binding element 'id' implicitly has an 'any' type.
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
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createAddonsListCommand = (program) =>
  program
    .command('addons:list', { hidden: true })
    .alias('addon:list')
    .description(`List currently installed add-ons for site`)
    .option('--json', 'Output add-on data as JSON')
    // @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
    .action(async (options, command) => {
      await addonsList(options, command)
    })
