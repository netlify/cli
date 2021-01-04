const chalk = require('chalk')
const inquirer = require('inquirer')
const isEmpty = require('lodash/isEmpty')

const { prepareAddonCommand, ADDON_VALIDATION } = require('../../utils/addons/prepare')
const generatePrompts = require('../../utils/addons/prompts')
const render = require('../../utils/addons/render')
const { requiredConfigValues, missingConfigValues, updateConfigValues } = require('../../utils/addons/validation')
const Command = require('../../utils/command')
const { parseRawFlags } = require('../../utils/parse-raw-flags')

const createAddon = async ({ api, siteId, addonName, config, siteData, log, error }) => {
  try {
    const response = await api.createServiceInstance({
      siteId,
      addon: addonName,
      body: { config },
    })
    log(`Add-on "${addonName}" created for ${siteData.name}`)
    if (response.config && response.config.message) {
      log()
      log(`${response.config.message}`)
    }
  } catch (error_) {
    error(error_.message)
  }
}

class AddonsCreateCommand extends Command {
  async run() {
    const { args, raw } = this.parse(AddonsCreateCommand)
    const addonName = args.name
    const { manifest, siteData } = await prepareAddonCommand({
      context: this,
      addonName,
      validation: ADDON_VALIDATION.NOT_EXISTS,
    })

    const { log, error, netlify } = this
    const { api, site } = netlify
    const siteId = site.id

    // GET flags from `raw` data
    const rawFlags = parseRawFlags(raw)
    const hasConfig = !isEmpty(manifest.config)

    let configValues = rawFlags

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'addons:create',
      },
    })

    if (hasConfig) {
      const required = requiredConfigValues(manifest.config)
      const missingValues = missingConfigValues(required, rawFlags)
      this.log(`Starting the setup for "${addonName} add-on"`)
      this.log()

      if (Object.keys(rawFlags).length !== 0) {
        const newConfig = updateConfigValues(manifest.config, {}, rawFlags)

        if (missingValues.length !== 0) {
          /* Warn user of missing required values */
          this.log(
            `${chalk.redBright.underline.bold(`Error: Missing required configuration for "${addonName} add-on"`)}`,
          )
          this.log()
          render.missingValues(missingValues, manifest)
          this.log()
          const msg = `netlify addons:create ${addonName}`
          this.log(`Please supply the configuration values as CLI flags`)
          this.log()
          this.log(`Alternatively, you can run ${chalk.cyan(msg)} with no flags to walk through the setup steps`)
          this.log()
          return false
        }

        await createAddon({ api, siteId, addonName, config: newConfig, siteData, log, error })

        return false
      }

      const words = `The ${addonName} add-on has the following configurable options:`
      this.log(` ${chalk.yellowBright.bold(words)}`)
      render.configValues(addonName, manifest.config)
      this.log()
      this.log(` ${chalk.greenBright.bold('Lets configure those!')}`)

      this.log()
      this.log(` - Hit ${chalk.white.bold('enter')} to confirm value or set empty value`)
      this.log(` - Hit ${chalk.white.bold('ctrl + C')} to cancel & exit configuration`)
      this.log()

      const prompts = generatePrompts({
        config: manifest.config,
        configValues: rawFlags,
      })

      const userInput = await inquirer.prompt(prompts)
      // Merge user input with the flags specified
      configValues = updateConfigValues(manifest.config, rawFlags, userInput)
      const missingRequiredValues = missingConfigValues(required, configValues)
      if (missingRequiredValues && missingRequiredValues.length !== 0) {
        missingRequiredValues.forEach((val) => {
          this.log(`Missing required value "${val}". Please run the command again`)
        })
        return false
      }
    }

    await createAddon({ api, siteId, addonName, config: configValues, siteData, log, error })
  }
}

AddonsCreateCommand.description = `Add an add-on extension to your site
...
Add-ons are a way to extend the functionality of your Netlify site
`
AddonsCreateCommand.aliases = ['addon:create']
AddonsCreateCommand.args = [
  {
    name: 'name',
    required: true,
    description: 'Add-on namespace',
  },
]

// allow for any flags. Handy for variadic configuration options
AddonsCreateCommand.strict = false

module.exports = AddonsCreateCommand
