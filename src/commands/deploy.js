const Command = require('../base')
const renderShortDesc = require('../utils/renderShortDescription')
const path = require('path')
const { flags } = require('@oclif/command')
const get = require('lodash.get')
const fs = require('fs')
const cliUx = require('cli-ux').default
const prettyjson = require('prettyjson')

class DeployCommand extends Command {
  async run() {
    await this.authenticate()
    const { args, flags } = this.parse(DeployCommand)

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
        await this.netlify.getSite({ siteId })
      } catch (e) {
        this.error(e.message)
      }
    }

    // TODO: abstract settings lookup
    const deployFolder =
      args.publishFolder ||
      get(this.site.toml, 'build.publish') ||
      get(await this.netlify.getSite({ siteId }), 'build_settings.dir')

    const functionsFolder =
      flags.functions ||
      get(this.site.toml, 'build.functions') ||
      get(await this.netlify.getSite({ siteId }), 'build_settings.functions_dir')

    if (!deployFolder) {
      this.error(
        `Can't determine a deploy folder.  Please define one in your site settings, netlift.toml or pass one as an argument.`
      )
    }

    // TODO go through the above resolution, and make sure the resolve algorithm makes sense
    const resolvedDeployPath = path.resolve(this.site.root, deployFolder)
    let resolvedFunctionsPath
    if (functionsFolder) resolvedFunctionsPath = path.resolve(this.site.root, functionsFolder)

    cliUx.action.start(`Starting a deploy from ${resolvedDeployPath}`)

    ensureDirectory(resolvedDeployPath, this.exit)
    if (resolvedFunctionsPath) ensureDirectory(resolvedDeployPath, this.exit)

    let results
    try {
      results = await this.netlify.deploy(siteId, resolvedDeployPath, resolvedFunctionsPath, this.site.tomlPath)
    } catch (e) {
      this.error(e)
    }
    cliUx.action.stop(`Finished deploy ${results.deployId}`)
    this.log(
      prettyjson.render({
        URL: results.deploy.ssl_url || results.deploy.url,
        Admin: results.deploy.admin_url
      })
    )
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

DeployCommand.flags = {
  functions: flags.string({
    description: 'Specify a function folder for a deploy'
  })
}

function ensureDirectory(resolvedDeployPath, exit) {
  let stat
  try {
    stat = fs.statSync(resolvedDeployPath)
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('No such directory! Make sure to run your build command locally first')
      exit()
    }

    // Improve the message of permission errors
    if (e.code === 'EACCES') {
      console.log('Permission error when trying to access deploy folder')
      exit()
    }
    throw e
  }
  if (!stat.isDirectory) {
    console.log('Deploy target must be a directory')
    exit()
  }
  return stat
}

module.exports = DeployCommand
