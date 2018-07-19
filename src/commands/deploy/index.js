const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const path = require('path')
const get = require('lodash.get')
const fs = require('fs')

const ensureDirectory = resolvedDeployPath => {
  let stat
  try {
    stat = fs.statSync(resolvedDeployPath)
  } catch (e) {
    if (e.code === 'ENOENT') {
      this.log('No such directory')
      this.exit()
    }

    // Improve the message of permission errors
    if (e.code === 'EACCES') {
      this.log('Permission error when trying to access deploy folder')
      this.exit()
    }
    throw e
  }
  if (!stat.isDirectory) {
    this.log('Deploy target must be a directory')
    this.exit()
  }
  return stat
}

class DeployCommand extends Command {
  async run() {
    const { args } = this.parse(DeployCommand)
    const siteId = this.site.get('siteId')
    if (!siteId) {
      this.log('Please link project to a netlify site first')
      this.exit()
    }
    const deployFolder =
      args.publishFolder ||
      get(this.site.toml, 'build.publish') ||
      get(await this.netlify.api.getSite(siteId), 'build_settings.dir')

    if (!deployFolder) {
      this.log(
        `Can't determine a deploy folder.  Please define one in your site settings, netlift.toml or pass one as an argument.`
      )
      this.exit()
    }

    const resolvedDeployPath = path.resolve(process.cwd(), deployFolder)
    this.log(`Starting a deploy from ${resolvedDeployPath}`)

    ensureDirectory(resolvedDeployPath)
    const results = await this.netlify.deploy(siteId, resolvedDeployPath)
    console.log(results)
  }
}

DeployCommand.description = `${renderShortDesc('Create a new deploy from the contents of a folder')}`

DeployCommand.args = [
  {
    name: 'publishFolder',
    required: false, // make the arg required with `required: true`
    description: 'folder to deploy'
  }
]

module.exports = DeployCommand
