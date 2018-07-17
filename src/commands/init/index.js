const Command = require('../../base')
const { flags } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')
const { CLIError } = require('@oclif/errors')

class InitCommand extends Command {
  async run() {
    await this.authenticate()
    const { flags } = this.parse(InitCommand)
    const siteId = this.site.get('siteId')

    if (siteId && !flags.force) {
      const site = await this.netlify.api.getSite(siteId)
      this.log(`Site already linked to ${site.name}`)
      this.log(`Link: ${site.admin_url}`)
      return this.exit()
    }

    if (flags.id) {
      let site
      try {
        site = await this.netlify.api.getSite(flags.id)
      } catch (e) {
        if (e.status === 404) throw new CLIError(`Site id ${flags.id} not found`)
        else throw new CLIError(e)
      }
      this.site.set('siteId', site.id)
      this.log(`Site initialized to ${site.name} in ${this.site.path}`)
      return this.exit()
    }

    if (flags.name) {
      let results
      try {
        results = await this.netlify.api.listSites({
          name: flags.name,
          filter: 'all'
        })
      } catch (e) {
        if (e.status === 404) throw new CLIError(`Site id ${flags.id} not found`)
        else throw new CLIError(e)
      }

      if (results.length === 0) {
        throw new CLIError(`No sites found named ${flags.name}`)
      }
      const site = results[0]
      this.site.set('siteId', site.id)
      this.log(`Site initialized to ${site.name} in ${this.site.path}`)
      return this.exit()
    }
  }
}

InitCommand.description = `${renderShortDesc('Configure continuous deployment in current working directory')}`

InitCommand.examples = ['$ netlify init --id 123-123-123-123', '$ netlify init --name my-site-name']

InitCommand.flags = {
  id: flags.string(),
  name: flags.string(),
  force: flags.boolean()
}

module.exports = InitCommand
