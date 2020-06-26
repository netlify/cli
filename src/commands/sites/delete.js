const inquirer = require('inquirer')
const chalk = require('chalk')
const Command = require('../../utils/command')
const { flags } = require('@oclif/command')
const { parseRawFlags } = require('../../utils/parse-raw-flags')

class SitesDeleteCommand extends Command {
  async run() {
    const { args, flags, raw } = this.parse(SitesDeleteCommand)
    const { api, site } = this.netlify
    const { siteId } = args
    const cwdSiteId = site.id

    // 1. Prompt user for verification
    await this.authenticate(flags.auth)

    let siteData
    try {
      siteData = await api.getSite({ siteId })
    } catch (err) {
      if (err.status === 404) {
        this.error(`No site with id ${siteId} found. Please verify the siteId & try again.`)
      }
    }

    if (!siteData) {
      this.error(`Unable to process site`)
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'sites:delete',
        force: flags.force,
      },
    })

    const { force, f } = parseRawFlags(raw)
    const noForce = !force && !f

    /* Verify the user wants to delete the site */
    if (noForce) {
      this.log(`${chalk.redBright('Warning')}: You are about to permanently delete "${chalk.bold(siteData.name)}"`)
      this.log(`         Verify this siteID "${cwdSiteId}" supplied is correct and proceed.`)
      this.log('         To skip this prompt, pass a --force flag to the delete command')
      this.log()
      this.log(`${chalk.bold('Be careful here. There is no undo!')}`)
      this.log()
      const { wantsToDelete } = await inquirer.prompt({
        type: 'confirm',
        name: 'wantsToDelete',
        message: `WARNING: Are you sure you want to delete the "${siteData.name}" site?`,
        default: false,
      })
      this.log()
      if (!wantsToDelete) {
        this.exit()
      }
    }

    /* Validation logic if siteId passed in does not match current site ID */
    if (noForce && cwdSiteId && cwdSiteId !== siteId) {
      this.log(`${chalk.redBright('Warning')}: The siteId supplied does not match the current working directory siteId`)
      this.log()
      this.log(`Supplied:       "${siteId}"`)
      this.log(`Current Site:   "${cwdSiteId}"`)
      this.log()
      this.log(`Verify this siteID "${cwdSiteId}" supplied is correct and proceed.`)
      this.log('To skip this prompt, pass a --force flag to the delete command')
      const { wantsToDelete } = await inquirer.prompt({
        type: 'confirm',
        name: 'wantsToDelete',
        message: `Verify & Proceed with deletion of site "${siteId}"?`,
        default: false,
      })
      if (!wantsToDelete) {
        this.exit()
      }
    }

    this.log(`Deleting site "${siteId}"...`)

    try {
      await api.deleteSite({ site_id: siteId })
    } catch (error) {
      if (error.status === 404) {
        this.error(`No site with id ${siteId} found. Please verify the siteId & try again.`)
      } else {
        this.error(`Delete Site error: ${error.status}: ${error.message}`)
      }
    }
    this.log(`Site "${siteId}" successfully deleted!`)
  }
}

SitesDeleteCommand.usage = `netlify sites:delete {site-id}`

SitesDeleteCommand.description = `Delete a site

This command will permanently delete the site on Netlify. Use with caution.
`

SitesDeleteCommand.args = [
  {
    name: 'siteId',
    required: true,
    description: 'Site ID to delete. `netlify delete 1234-5678-890`',
  },
]

SitesDeleteCommand.flags = {
  ...SitesDeleteCommand.flags,
  force: flags.boolean({
    char: 'f',
    description: 'delete without prompting (useful for CI)',
  }),
}

SitesDeleteCommand.examples = ['netlify site:delete 1234-3262-1211']

module.exports = SitesDeleteCommand
