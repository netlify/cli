const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const path = require('path')
const get = require('lodash.get')
const fs = require('fs')
const cliUx = require('cli-ux').default

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
    await this.authenticate()
    const { args } = this.parse(DeployCommand)

    const accessToken = this.global.get('accessToken')
    if (!accessToken) {
      this.error(`Not logged in. Log in to deploy to a site`)
    }

    const siteId = this.site.get('siteId')
    if (!siteId) {
      this.log('Please link project to a netlify site first')
      this.exit()
    } else {
      try {
        await this.netlify.api.getSite(siteId)
      } catch (e) {
        this.error(e.message)
      }
    }

    // TODO: abstract settings lookup
    const deployFolder =
      args.publishFolder ||
      get(this.site.toml, 'build.publish') ||
      get(await this.netlify.api.getSite(siteId), 'build_settings.dir')

    if (!deployFolder) {
      this.error(
        `Can't determine a deploy folder.  Please define one in your site settings, netlift.toml or pass one as an argument.`
      )
    }

    const resolvedDeployPath = path.resolve(process.cwd(), deployFolder)
    cliUx.action.start(`Starting a deploy from ${resolvedDeployPath}`)

    ensureDirectory(resolvedDeployPath)
    let results
    try {
      results = await this.netlify.deploy(siteId, resolvedDeployPath)
    } catch (e) {
      this.error(JSON.stringify(e.response))
      this.error(e.message)
      this.error(e.status)
      this.error(e)
    }
    cliUx.action.stop('Finished deploy')
    console.log(results)
  }
}

DeployCommand.description = `${renderShortDesc('Create a new deploy from the contents of a folder.')}`

DeployCommand.args = [
  {
    name: 'publishFolder',
    required: false, // make the arg required with `required: true`
    description: 'folder to deploy (optional)'
  }
]

module.exports = DeployCommand
