const Command = require('../../utils/command')
const { getAddons, createAddon, showServiceManifest } = require('../../lib/api')
const { parseRawFlags } = require('../../utils/parse-raw-flags')
const { requiredConfigValues, missingConfigValues, updateConfigValues } = require('../../utils/addons/validation')
const generatePrompts = require('../../utils/addons/prompts')
const render = require('../../utils/addons/render')
const chalk = require('chalk')
const inquirer = require('inquirer')

class AddonsCreateCommand extends Command {
  async run() {
    const { args, raw } = this.parse(AddonsCreateCommand)
    const addonName = args.name

    await this.authenticate()
    const { api, site } = this.netlify
    const siteId = site.id

    if (!siteId) {
      this.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    let addons
    try {
      addons = await getAddons({ api, siteId })
    } catch (error) {
      this.log(`API Error: ${error.message}`)
      return false
    }

    // Filter down addons to current args.name
    const currentAddon = addons.find(addon => addon.service_path === `/.netlify/${addonName}`)

    // GET flags from `raw` data
    const rawFlags = parseRawFlags(raw)

    const siteData = await this.netlify.api.getSite({ siteId })
    if (currentAddon && currentAddon.id) {
      this.log(`The "${addonName} add-on" already exists for ${siteData.name}`)
      this.log()
      const cmd = chalk.cyan(`\`netlify addons:config ${addonName}\``)
      this.log(`- To update this add-on run: ${cmd}`)
      const deleteCmd = chalk.cyan(`\`netlify addons:delete ${addonName}\``)
      this.log(`- To remove this add-on run: ${deleteCmd}`)
      this.log()
      return false
    }

    const manifest = await showServiceManifest({ api, addonName })
    const hasConfig = manifest.config && Object.keys(manifest.config).length

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
            `${chalk.redBright.underline.bold(`Error: Missing required configuration for "${addonName} add-on"`)}`
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

        try {
          await createAddon({ api, siteId, addon: addonName, config: newConfig })
          this.log(`Add-on "${addonName}" created for ${siteData.name}`)
        } catch (e) {
          this.error(e.message)
        }

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
        missingRequiredValues.forEach(val => {
          this.log(`Missing required value "${val}". Please run the command again`)
        })
        return false
      }
    }

    try {
      await createAddon({ api, siteId, addon: addonName, config: configValues })
      this.log(`Add-on "${addonName}" created for ${siteData.name}`)
    } catch (error) {
      this.error(error.message)
    }
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
