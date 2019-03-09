const Command = require('../../base')
const { getAddons, updateAddon } = require('netlify/src/addons')
const getAddonManifest = require('../../utils/addons/api')
const { requiredConfigValues, missingConfigValues, updateConfigValues } = require('../../utils/addons/validation')
const generatePrompts = require('../../utils/addons/prompts')
const render = require('../../utils/addons/render')
const diffValues = require('../../utils/addons/diffs/index')
const compare = require('../../utils/addons/compare')
const parseRawFlags = require('../../utils/parseRawFlags')
const chalk = require('chalk')
const inquirer = require('inquirer')

class AddonsConfigCommand extends Command {
  async run() {
    const accessToken = await this.authenticate()
    const { args, raw } = this.parse(AddonsConfigCommand)
    const addonName = args.name
    const siteId = this.netlify.site.id

    if (!siteId) {
      this.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    const site = await this.netlify.api.getSite({ siteId })
    const addons = await getAddons(siteId, accessToken)

    if (typeof addons === 'object' && addons.error) {
      this.log('API Error', addons)
      return false
    }

    // Filter down addons to current args.name
    const currentAddon = addons.find(addon => addon.service_path === `/.netlify/${addonName}`)

    if (!currentAddon || !currentAddon.id) {
      this.log(`Add-on ${addonName} doesn't exist for ${site.name}`)
      this.log(`> Run \`netlify addons:create ${addonName}\` to create an instance for this site`)
      return false
    }

    const manifest = await getAddonManifest(addonName, accessToken)
    // Parse flags
    const rawFlags = parseRawFlags(raw)
    // Get Existing Config
    const currentConfig = currentAddon.config || {}

    const words = `Current "${addonName} add-on" Settings:`
    this.log(` ${chalk.yellowBright.bold(words)}`)
    if (manifest.config) {
      render.configValues(addonName, manifest.config, currentConfig)
    } else {
      // For addons without manifest. TODO remove once we enfore manifests
      Object.keys(currentConfig).forEach(key => {
        this.log(`${key} - ${currentConfig[key]}`)
      })
    }

    if (manifest.config) {
      const required = requiredConfigValues(manifest.config)
      const missingValues = missingConfigValues(required, rawFlags)

      /* Config set by command line flags */
      if (rawFlags && !missingValues.length) {
        const newConfig = updateConfigValues(manifest.config, currentConfig, rawFlags)

        await this.update({
          addonName,
          currentConfig,
          newConfig,
          settings: {
            siteId: siteId,
            instanceId: currentAddon.id,
            addon: addonName,
            config: newConfig
          },
          accessToken
        })
        return false
      }

      const updatePrompt = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'updateNow',
          message: `Do you want to update config values?`,
          default: false
        }
      ])
      if (!updatePrompt.updateNow) {
        this.log('Sounds good! Exiting configuration...')
        return false
      }
      this.log()
      this.log(` - Hit ${chalk.white.bold('enter')} to keep the existing value in (parentheses)`)
      this.log(` - Hit ${chalk.white.bold('down arrow')} to remove the value`)
      this.log(` - Hit ${chalk.white.bold('ctrl + C')} to cancel & exit configuration`)
      this.log()
      this.log(` You will need to verify the changed before we push them to your live site!`)
      this.log()
      const prompts = generatePrompts({
        config: manifest.config,
        configValues: currentConfig
      })
      const userInput = await inquirer.prompt(prompts)
      // Merge user input with the flags specified
      const newConfig = updateConfigValues(manifest.config, currentConfig, userInput)

      const diffs = compare(currentConfig, newConfig)
      // this.log('compare', diffs)
      if (diffs.isEqual) {
        this.log(`No changes. exiting early`)
        return false
      }
      this.log()
      this.log(`${chalk.yellowBright.bold.underline('Confirm your updates:')}`)
      this.log()
      diffs.keys.forEach(key => {
        const { newValue, oldValue } = diffs.diffs[key]
        const oldVal = oldValue || 'NO VALUE'
        this.log(`${chalk.cyan(key)} changed from ${chalk.whiteBright(oldVal)} to ${chalk.green(newValue)}`)
      })
      this.log()

      const confirmPrompt = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmChange',
          message: `Do you want to publish the updated "${addonName} add-on" settings for ${chalk.cyan(site.name)}?`,
          default: false
        }
      ])

      if (!confirmPrompt.confirmChange) {
        this.log('Canceling changes... You are good to go!')
        return false
      }

      await this.update({
        addonName,
        currentConfig,
        newConfig,
        settings: {
          siteId: siteId,
          instanceId: currentAddon.id,
          addon: addonName,
          config: newConfig
        },
        accessToken
      })
    }
  }

  async update({ addonName, currentConfig, newConfig, settings, accessToken }) {
    const codeDiff = diffValues(currentConfig, newConfig)
    if (!codeDiff) {
      this.log('No changes, exiting early')
      return false
    }
    this.log()
    const msg = `Updating ${addonName} add-on config values...`
    this.log(`${chalk.white.bold(msg)}`)
    this.log()
    this.log(`${codeDiff}\n`)
    this.log()

    const updateAddonResponse = await updateAddon(settings, accessToken)
    if (updateAddonResponse.code === 404) {
      this.log(`No add-on "${addonName}" found. Please double check your add-on name and try again`)
      return false
    }
    this.log(`Add-on "${addonName}" successfully updated`)
    return updateAddonResponse
  }
}

AddonsConfigCommand.args = [
  {
    name: 'name',
    required: true,
    description: 'Add-on namespace'
  }
]

AddonsConfigCommand.description = `Configure add-on settings`
// allow for any flags. Handy for variadic configuration options
AddonsConfigCommand.strict = false

AddonsConfigCommand.hidden = true

module.exports = AddonsConfigCommand
