const Command = require('../../base')
const { getAddons, createAddon } = require('netlify/src/addons')
const parseRawFlags = require('../../utils/parseRawFlags')
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

    const siteData = await api.getSite({
      siteId
    })
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

    let configValues = rawFlags
    if (manifest.config) {
      const required = requiredConfigValues(manifest.config)
      const missingValues = missingConfigValues(required, rawFlags)
      console.log(`Starting the setup for "${addonName} add-on"`)
      console.log()

      if (Object.keys(rawFlags).length) {
        const newConfig = updateConfigValues(manifest.config, {}, rawFlags)

        if (missingValues.length) {
          /* Warn user of missing required values */
          console.log(
            `${chalk.redBright.underline.bold(`Error: Missing required configuration for "${addonName} add-on"`)}`
          )
          console.log()
          render.missingValues(missingValues, manifest)
          console.log()
          const msg = `netlify addons:create ${addonName}`
          console.log(`Please supply the configuration values as CLI flags`)
          console.log()
          console.log(`Alternatively, you can run ${chalk.cyan(msg)} with no flags to walk through the setup steps`)
          console.log()
          return false
        }

        await createSiteAddon({
          addonName,
          settings: {
            siteId: siteId,
            addon: addonName,
            config: newConfig
          },
          accessToken,
          siteData
        })
        return false
      }

      const words = `The ${addonName} add-on has the following configurable options:`
      console.log(` ${chalk.yellowBright.bold(words)}`)
      render.configValues(addonName, manifest.config)
      console.log()
      console.log(` ${chalk.greenBright.bold('Lets configure those!')}`)

      console.log()
      console.log(` - Hit ${chalk.white.bold('enter')} to confirm value or set empty value`)
      console.log(` - Hit ${chalk.white.bold('ctrl + C')} to cancel & exit configuration`)
      console.log()

      const prompts = generatePrompts({
        config: manifest.config,
        configValues: rawFlags
      })

      const userInput = await inquirer.prompt(prompts)
      // Merge user input with the flags specified
      configValues = updateConfigValues(manifest.config, rawFlags, userInput)
      const missingRequiredValues = missingConfigValues(required, configValues)
      if (missingRequiredValues && missingRequiredValues.length) {
        missingRequiredValues.forEach(val => {
          console.log(`Missing required value "${val}". Please run the command again`)
        })
        return false
      }
    }

    await createSiteAddon({
      addonName,
      settings: {
        siteId: siteId,
        addon: addonName,
        config: configValues
      },
      accessToken,
      siteData
    })
  }
}

async function createSiteAddon({ addonName, settings, accessToken, siteData }) {
  // TODO update to https://open-api.netlify.com/#/default/createServiceInstance
  const addonResponse = await createAddon(settings, accessToken)
  if (addonResponse.code === 404) {
    console.log(`No add-on "${addonName}" found. Please double check your add-on name and try again`)
    return false
  }
  console.log(`Add-on "${addonName}" created for ${siteData.name}`)
  if (addonResponse.config && addonResponse.config.message) {
    console.log()
    console.log(`${addonResponse.config.message}`)
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
    description: 'Add-on namespace'
  }
]

// allow for any flags. Handy for variadic configuration options
AddonsCreateCommand.strict = false
AddonsCreateCommand.hidden = true

module.exports = AddonsCreateCommand
