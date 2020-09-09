const Command = require('../../utils/command')
const inquirer = require('inquirer')
const { getAddons, deleteAddon } = require('netlify/src/addons')
const { parseRawFlags } = require('../../utils/parse-raw-flags')
const { flags } = require('@oclif/command')

class AddonsDeleteCommand extends Command {
  async run() {
    const accessToken = await this.authenticate()
    const { args, raw } = this.parse(AddonsDeleteCommand)
    const { site } = this.netlify

    const addonName = args.name

    const siteId = site.id

    if (!siteId) {
      this.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    const addons = await getAddons(siteId, accessToken)

    if (typeof addons === 'object' && addons.error) {
      this.log('API Error', addons)
      return false
    }

    // Filter down addons to current args.name
    const currentAddon =
      addons.find(current => current.service_path && current.service_path.replace('/.netlify/', '') === addonName) || {}

    const { force, f } = parseRawFlags(raw)
    if (!force && !f) {
      const { wantsToDelete } = await inquirer.prompt({
        type: 'confirm',
        name: 'wantsToDelete',
        message: `Are you sure you want to delete the ${addonName} add-on? (to skip this prompt, pass a --force flag)`,
        default: false,
      })
      if (!wantsToDelete) {
        this.exit()
      }
    }

    if (!currentAddon.id) {
      this.log(`No add-on "${addonName}" found for site. Add-on already deleted or never existed!`)
      this.log(`> Run \`netlify addons:create ${addonName}\` to create an instance for this site`)
      return false
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'addons:delete',
      },
    })

    const settings = {
      siteId,
      addon: addonName,
      instanceId: currentAddon.id,
    }
    let addonResponse
    try {
      // TODO update deleteAddon to https://open-api.netlify.com/#operation/deleteServiceInstance
      addonResponse = await deleteAddon(settings, accessToken)
    } catch (e) {
      this.error(e.message)
    }

    if (addonResponse.status === 404) {
      this.log(`No addon "${addonName}" found. Please double check your add-on name and try again`)
      return false
    }

    /* Deleting addons must return with 204 status */
    if (addonResponse.status === 204) {
      this.log(`Addon "${addonName}" deleted`)
    } else {
      this.log(
        `Addon "${addonName}" was not deleted "${addonName}". Returned status: ${addonResponse.status}. Addon deletion must return status 204 from "${addonName}" provider.`
      )
    }
  }
}

AddonsDeleteCommand.description = `Remove an add-on extension to your site
...
Add-ons are a way to extend the functionality of your Netlify site
`

// allow for any flags. Handy for variadic configuration options
AddonsDeleteCommand.strict = false
AddonsDeleteCommand.aliases = ['addon:delete']
AddonsDeleteCommand.flags = {
  force: flags.boolean({
    char: 'f',
    description: 'delete without prompting (useful for CI)',
  }),
  ...AddonsDeleteCommand.flags,
}
AddonsDeleteCommand.args = [
  {
    name: 'name',
    required: true,
    description: 'Add-on namespace',
  },
]

module.exports = AddonsDeleteCommand
