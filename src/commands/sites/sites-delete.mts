// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'inquirer'.
const inquirer = require('inquirer')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
const { chalk, error, exit, log } = require('../../utils/index.mjs')

/**
 * The sites:delete command
 * @param {string} siteId
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const sitesDelete = async (siteId: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
  command.setAnalyticsPayload({ force: options.force })

  const { api, site } = command.netlify
  const cwdSiteId = site.id

  // 1. Prompt user for verification
  await command.authenticate(options.auth)

  let siteData
  try {
    siteData = await api.getSite({ siteId })
  } catch (error_) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if ((error_ as $TSFixMe).status === 404) {
      error(`No site with id ${siteId} found. Please verify the siteId & try again.`)
    }
  }

  if (!siteData) {
    error(`Unable to process site`)
  }

  const noForce = options.force !== true

  /* Verify the user wants to delete the site */
  if (noForce) {
    log(`${chalk.redBright('Warning')}: You are about to permanently delete "${chalk.bold(siteData.name)}"`)
    log(`         Verify this siteID "${siteId}" supplied is correct and proceed.`)
    log('         To skip this prompt, pass a --force flag to the delete command')
    log()
    log(`${chalk.bold('Be careful here. There is no undo!')}`)
    log()
    const { wantsToDelete } = await inquirer.prompt({
      type: 'confirm',
      name: 'wantsToDelete',
      message: `WARNING: Are you sure you want to delete the "${siteData.name}" site?`,
      default: false,
    })
    log()
    if (!wantsToDelete) {
      exit()
    }
  }

  /* Validation logic if siteId passed in does not match current site ID */
  if (noForce && cwdSiteId && cwdSiteId !== siteId) {
    log(`${chalk.redBright('Warning')}: The siteId supplied does not match the current working directory siteId`)
    log()
    log(`Supplied:       "${siteId}"`)
    log(`Current Site:   "${cwdSiteId}"`)
    log()
    log(`Verify this siteID "${siteId}" supplied is correct and proceed.`)
    log('To skip this prompt, pass a --force flag to the delete command')
    const { wantsToDelete } = await inquirer.prompt({
      type: 'confirm',
      name: 'wantsToDelete',
      message: `Verify & Proceed with deletion of site "${siteId}"?`,
      default: false,
    })
    if (!wantsToDelete) {
      exit()
    }
  }

  log(`Deleting site "${siteId}"...`)

  try {
    await api.deleteSite({ site_id: siteId })
  } catch (error_) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if ((error_ as $TSFixMe).status === 404) {
      error(`No site with id ${siteId} found. Please verify the siteId & try again.`)
    } else {
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      error(`Delete Site error: ${(error_ as $TSFixMe).status}: ${(error_ as $TSFixMe).message}`);
    }
  }
  log(`Site "${siteId}" successfully deleted!`)
}

/**
 * Creates the `netlify sites:delete` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createSite... Remove this comment to see the full error message
const createSitesDeleteCommand = (program: $TSFixMe) => program
  .command('sites:delete')
  .description('Delete a site\nThis command will permanently delete the site on Netlify. Use with caution.')
  .argument('<siteId>', 'Site ID to delete.')
  .option('-f, --force', 'delete without prompting (useful for CI)')
  .addExamples(['netlify sites:delete 1234-3262-1211'])
  .action(sitesDelete)

module.exports = { createSitesDeleteCommand }
