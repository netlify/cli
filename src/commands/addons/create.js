const Command = require('../../utils/command')
const { getAddons, createAddon } = require('netlify/src/addons')
const { parseRawFlags } = require('../../utils/parse-raw-flags')
const getAddonManifest = require('../../utils/addons/api')
const { requiredConfigValues, missingConfigValues, updateConfigValues } = require('../../utils/addons/validation')
const generatePrompts = require('../../utils/addons/prompts')
const render = require('../../utils/addons/render')
const chalk = require('chalk')
const inquirer = require('inquirer')

class AddonsCreateCommand extends Command {
  async run() {
    const accessToken = await this.authenticate()
    const { args, raw } = this.parse(AddonsCreateCommand)
    const { api, site } = this.netlify

    const addonName = args.name

    if (!addonName) {
      this.log('Please provide an add-on name to provision')
      this.exit()
    }

    const siteId = site.id

    if (!siteId) {
      this.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    const siteData = await api.getSite({ siteId })
    const addons = await getAddons(siteId, accessToken)

    if (typeof addons === 'object' && addons.error) {
      this.log('API Error', addons)
      return false
    }

    // Filter down addons to current args.name
    const currentAddon = addons.find(addon => addon.service_path === `/.netlify/${addonName}`)

    // GET flags from `raw` data
    const rawFlags = parseRawFlags(raw)

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

    const manifest = await getAddonManifest(addonName, accessToken)
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

      if (Object.keys(rawFlags).length) {
        const newConfig = updateConfigValues(manifest.config, {}, rawFlags)

        if (missingValues.length) {
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

        await createSiteAddon(
          {
            addonName,
            settings: {
              siteId: siteId,
              addon: addonName,
              config: newConfig,
            },
            accessToken,
            siteData,
            error: this.error,
          },
          this.log
        )
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
      if (missingRequiredValues && missingRequiredValues.length) {
        missingRequiredValues.forEach(val => {
          this.log(`Missing required value "${val}". Please run the command again`)
        })
        return false
      }
    }

    await createSiteAddon(
      {
        addonName,
        settings: {
          siteId: siteId,
          addon: addonName,
          config: configValues,
        },
        accessToken,
        siteData,
        error: this.error,
      },
      this.log
    )
  }
}

async function createSiteAddon({ addonName, settings, accessToken, siteData, error }, logger) {
  let addonResponse
  try {
    // TODO update to https://open-api.netlify.com/#operation/createServiceInstance
    addonResponse = await createAddon(settings, accessToken)
  } catch (e) {
    error(e.message)
  }

  if (addonResponse.code === 404) {
    logger(`No add-on "${addonName}" found. Please double check your add-on name and try again`)
    return false
  }
  logger(`Add-on "${addonName}" created for ${siteData.name}`)
  if (addonResponse.config && addonResponse.config.message) {
    logger()
    logger(`${addonResponse.config.message}`)
  }
  return addonResponse
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
