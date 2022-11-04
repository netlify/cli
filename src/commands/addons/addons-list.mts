// @ts-check

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'AsciiTable... Remove this comment to see the full error message
const AsciiTable = require('ascii-table')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'prepareAdd... Remove this comment to see the full error message
const { prepareAddonCommand } = require('../../utils/addons/prepare.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'log'.
const { log, logJson } = require('../../utils/index.mjs')

/**
 * The addons:list command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const addonsList = async (options: $TSFixMe, command: $TSFixMe) => {
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

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  const addonData = addons.map((addon: $TSFixMe) => ({
    namespace: addon.service_path.replace('/.netlify/', ''),
    name: addon.service_name,
    id: addon.id
  }))

  // Build a table out of addons
  log(`site: ${siteData.name}`)
  const table = new AsciiTable(`Currently Installed addons`)

  table.setHeading('NameSpace', 'Name', 'Instance Id')

  addonData.forEach(({
    id,
    name,
    namespace
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe) => {
    table.addRow(namespace, name, id)
  })
  // Log da addons
  log(table.toString())
}

/**
 * Creates the `netlify addons:list` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createAddo... Remove this comment to see the full error message
const createAddonsListCommand = (program: $TSFixMe) => program
  .command('addons:list')
  .alias('addon:list')
  .description(`List currently installed add-ons for site`)
  .option('--json', 'Output add-on data as JSON')
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  .action(async (options: $TSFixMe, command: $TSFixMe) => {
    await addonsList(options, command)
  })

module.exports = { createAddonsListCommand }
