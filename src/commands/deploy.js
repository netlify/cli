const Command = require('../base')
const renderShortDesc = require('../utils/renderShortDescription')
const path = require('path')
const { flags } = require('@oclif/command')
const get = require('lodash.get')
const fs = require('fs')
const prettyjson = require('prettyjson')
const ora = require('ora')
const logSymbols = require('log-symbols')
const cliSpinnerNames = Object.keys(require('cli-spinners'))
const randomItem = require('random-item')

class DeployCommand extends Command {
  async run() {
    await this.authenticate()
    const { flags } = this.parse(DeployCommand)

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
      flags['publish'] ||
      get(this.site.toml, 'build.publish') ||
      get(await this.netlify.getSite({ siteId }), 'build_settings.dir')

    const functionsFolder =
      flags.functions ||
      get(this.site.toml, 'build.functions') ||
      get(await this.netlify.getSite({ siteId }), 'build_settings.functions_dir')

    if (!deployFolder) {
      this.error(
        `Can't determine a deploy folder.  Please define one in your site settings, netlift.toml or pass one as a flag.`
      )
    }

    if (flags.draft) this.error('Draft deploys not implemented (yet)')

    // TODO go through the above resolution, and make sure the resolve algorithm makes sense
    const resolvedDeployPath = path.resolve(this.site.root, deployFolder)
    let resolvedFunctionsPath
    if (functionsFolder) resolvedFunctionsPath = path.resolve(this.site.root, functionsFolder)

    // cliUx.action.start(`Starting a deploy from ${resolvedDeployPath}`)

    ensureDirectory(resolvedDeployPath, this.exit)
    if (resolvedFunctionsPath) ensureDirectory(resolvedFunctionsPath, this.exit)

    let results
    try {
      results = await this.netlify.deploy(siteId, resolvedDeployPath, resolvedFunctionsPath, this.site.tomlPath, {
        statusCb: deployProgressCb(this)
      })
    } catch (e) {
      this.error(e)
    }
    // cliUx.action.stop(`Finished deploy ${results.deployId}`)
    this.log(
      prettyjson.render({
        URL: results.deploy.ssl_url || results.deploy.url,
        Logs: `${get(results, 'deploy.admin_url')}/deploys/${get(results, 'deploy.id')}`,
        'Deploy URL': get(results, 'deploy.deploy_ssl_url') || get(results, 'deploy.deploy_url')
      })
    )
  }
}

DeployCommand.description = `${renderShortDesc(`Create a new deploy from the contents of a folder`)}

Deploys from the build settings found in the netlify.toml file, or settings from the api.
`

DeployCommand.flags = {
  functions: flags.string({
    char: 'f',
    description: 'Specify a functions folder to deploy'
  }),
  publish: flags.string({
    char: 'p',
    description: 'Specify a folder to deploy'
  }),
  draft: flags.string({
    char: 'd',
    description: 'Create a draft deploy'
  })
}

function deployProgressCb(ctx) {
  const events = {}
  /* statusObj: {
            type: name-of-step
            msg: msg to print
            phase: [start, progress, stop]
        } */
  return ev => {
    switch (ev.phase) {
      case 'start': {
        const spinner = ev.spinner || randomItem(cliSpinnerNames)
        events[ev.type] = ora({
          text: ev.msg,
          spinner: spinner
        }).start()
        return
      }
      case 'progress': {
        const spinner = events[ev.type]
        if (spinner) spinner.text = ev.msg
        return
      }
      case 'stop':
      default: {
        const spinner = events[ev.type]
        if (spinner) {
          spinner.stopAndPersist({ text: ev.msg, symbol: logSymbols.success })
          delete events[ev.type]
        }
        return
      }
    }
  }
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
