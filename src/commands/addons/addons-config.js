// @ts-check
const inquirer = require('inquirer')
const isEmpty = require('lodash/isEmpty')

const { chalk, error, log, parseRawFlags } = require('../../utils')
const compare = require('../../utils/addons/compare')
const diffValues = require('../../utils/addons/diffs')
const { ADDON_VALIDATION, prepareAddonCommand } = require('../../utils/addons/prepare')
const generatePrompts = require('../../utils/addons/prompts')
const render = require('../../utils/addons/render')
const { missingConfigValues, requiredConfigValues, updateConfigValues } = require('../../utils/addons/validation')

const update = async function ({ addonName, api, currentConfig, instanceId, newConfig, siteId }) {
  const codeDiff = diffValues(currentConfig, newConfig)
  if (!codeDiff) {
    log('No changes, exiting early')
    return false
  }
  log()
  const msg = `Updating ${addonName} add-on config values...`
  log(`${chalk.white.bold(msg)}`)
  log()
  log(`${codeDiff}\n`)
  log()

  try {
    await api.updateServiceInstance({
      siteId,
      addon: addonName,
      instanceId,
      body: { config: newConfig },
    })
    log(`Add-on "${addonName}" successfully updated`)
  } catch (error_) {
    error(error_.message)
  }
}

/**
 * The addons:config command
 * @param {string} addonName
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
const addonsConfig = async (addonName, options, command) => {
  const { addon, manifest, siteData } = await prepareAddonCommand({
    command,
    addonName,
    // @ts-ignore
    validation: ADDON_VALIDATION.EXISTS,
  })

  const { api, site } = command.netlify
  const siteId = site.id

  const hasConfig = !isEmpty(manifest.config)
  // Parse flags
  const rawFlags = parseRawFlags(command.args)
  // Get Existing Config
  const currentConfig = addon.config || {}

  const words = `Current "${addonName} add-on" Settings:`
  log(` ${chalk.yellowBright.bold(words)}`)
  if (hasConfig) {
    if (!rawFlags.silent) {
      render.configValues(addonName, manifest.config, currentConfig)
    }
  } else {
    // For addons without manifest. TODO remove once we enforce manifests
    Object.keys(currentConfig).forEach((key) => {
      log(`${key} - ${currentConfig[key]}`)
    })
  }

  if (hasConfig) {
    const required = requiredConfigValues(manifest.config)
    const missingValues = missingConfigValues(required, rawFlags)

    /* Config set by command line flags */
    if (rawFlags && missingValues.length === 0) {
      const newConfig = updateConfigValues(manifest.config, currentConfig, rawFlags)

      await update({
        addonName,
        currentConfig,
        newConfig,
        siteId,
        instanceId: addon.id,
        api,
      })
      return false
    }

    const updatePrompt = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'updateNow',
        message: `Do you want to update config values?`,
        default: false,
      },
    ])
    if (!updatePrompt.updateNow) {
      log('Sounds good! Exiting configuration...')
      return false
    }
    log()
    log(` - Hit ${chalk.white.bold('enter')} to keep the existing value in (parentheses)`)
    log(` - Hit ${chalk.white.bold('down arrow')} to remove the value`)
    log(` - Hit ${chalk.white.bold('ctrl + C')} to cancel & exit configuration`)
    log()
    log(` You will need to verify the changed before we push them to your live site!`)
    log()
    const prompts = generatePrompts({
      config: manifest.config,
      configValues: currentConfig,
    })
    const userInput = await inquirer.prompt(prompts)
    // Merge user input with the flags specified
    const newConfig = updateConfigValues(manifest.config, currentConfig, userInput)

    const diffs = compare(currentConfig, newConfig)
    // log('compare', diffs)
    if (diffs.isEqual) {
      log(`No changes. exiting early`)
      return false
    }
    log()
    log(`${chalk.yellowBright.bold.underline('Confirm your updates:')}`)
    log()
    diffs.keys.forEach((key) => {
      const { newValue, oldValue } = diffs.diffs[key]
      const oldVal = oldValue || 'NO VALUE'
      log(`${chalk.cyan(key)} changed from ${chalk.whiteBright(oldVal)} to ${chalk.green(newValue)}`)
    })
    log()

    const confirmPrompt = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmChange',
        message: `Do you want to publish the updated "${addonName} add-on" settings for ${chalk.cyan(siteData.name)}?`,
        default: false,
      },
    ])

    if (!confirmPrompt.confirmChange) {
      log('Canceling changes... You are good to go!')
      return false
    }

    await update({
      addonName,
      currentConfig,
      newConfig,
      siteId,
      instanceId: addon.id,
      api,
    })
  }
}

/**
 * Creates the `netlify addons:config` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createAddonsConfigCommand = (program) =>
  program
    .command('addons:config')
    .alias('addon:config')
    .argument('<name>', 'Add-on namespace')
    .description('Configure add-on settings')
    // allow for any flags. Handy for variadic configuration options
    .allowUnknownOption(true)
    .action(async (addonName, options, command) => {
      await addonsConfig(addonName, options, command)
    })

module.exports = { createAddonsConfigCommand }
