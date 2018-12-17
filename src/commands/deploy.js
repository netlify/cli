const Command = require('../base')
const openBrowser = require('../utils/open-browser')
const path = require('path')
const chalk = require('chalk')
const { flags } = require('@oclif/command')
const get = require('lodash.get')
const fs = require('fs')
const prettyjson = require('prettyjson')
const ora = require('ora')
const logSymbols = require('log-symbols')
const cliSpinnerNames = Object.keys(require('cli-spinners'))
const randomItem = require('random-item')
const inquirer = require('inquirer')
const SitesCreateCommand = require('./sites/create')
const LinkCommand = require('./link')

class DeployCommand extends Command {
  async run() {
    const { flags } = this.parse(DeployCommand)
    const { api, site, config } = this.netlify

    const deployToProduction = flags.prod
    await this.authenticate(flags.auth)

    let siteId = flags.site || site.id
    let siteData
    if (!siteId) {
      this.log("This folder isn't linked to a site yet")
      const NEW_SITE = '+  Create & configure a new site'
      const EXISTING_SITE = '⇄  Link this directory to an existing site'

      const initializeOpts = [EXISTING_SITE, NEW_SITE]

      const { initChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'initChoice',
          message: 'What would you like to do?',
          choices: initializeOpts
        }
      ])
      // create site or search for one
      if (initChoice === NEW_SITE) {
        // run site:create command
        siteData = await SitesCreateCommand.run([])
        site.id = siteData.id
        siteId = site.id
      } else if (initChoice === EXISTING_SITE) {
        // run link command
        siteData = await LinkCommand.run([], false)
      }
    } else {
      try {
        siteData = await api.getSite({ siteId })
      } catch (e) {
        // TODO specifically handle known cases (e.g. no account access)
        this.error(e.message)
      }
    }

    // TODO: abstract settings lookup
    let deployFolder
    if (flags['dir']) {
      deployFolder = path.resolve(process.cwd(), flags['dir'])
    } else if (get(config, 'build.publish')) {
      deployFolder = path.resolve(site.root, get(config, 'build.publish'))
    } else if (get(siteData, 'build_settings.dir')) {
      deployFolder = path.resolve(site.root, get(siteData, 'build_settings.dir'))
    }

    let functionsFolder
    if (flags['functions']) {
      functionsFolder = path.resolve(process.cwd(), flags['functions'])
    } else if (get(site.config, 'build.functions')) {
      functionsFolder = path.resolve(site.root, get(site.config, 'build.functions'))
    } else if (get(siteData, 'build_settings.functions_dir')) {
      functionsFolder = path.resolve(site.root, get(siteData, 'build_settings.functions_dir'))
    }

    if (!deployFolder) {
      this.log('Please provide a deploy path relative to:')
      this.log(process.cwd())
      const { promptPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'promptPath',
          message: 'deploy path',
          default: '.',
          filter: input => path.resolve(process.cwd(), input)
        }
      ])
      deployFolder = promptPath
    }

    const pathInfo = {
      'Deploy path': deployFolder
    }

    if (functionsFolder) {
      pathInfo['Functions path'] = functionsFolder
    }
    let configPath
    if (site.configPath) {
      configPath = site.configPath
      pathInfo['Configuration path'] = configPath
    }
    this.log(prettyjson.render(pathInfo))

    ensureDirectory(deployFolder, this.exit)

    if (functionsFolder) {
      ensureDirectory(functionsFolder, this.exit)
    }

    let results
    try {
      if (deployToProduction) {
        this.log('Deploying to live site URL...')
      } else {
        this.log('Deploying to draft URL...')
      }

      results = await api.deploy(siteId, deployFolder, {
        configPath: configPath,
        fnDir: functionsFolder,
        statusCb: deployProgressCb(),
        draft: !deployToProduction,
        message: flags.message
      })
    } catch (e) {
      switch (true) {
        case e.name === 'JSONHTTPError': {
          this.error(e.json.message)
          return
        }
        case e.name === 'TextHTTPError': {
          this.error(e.data)
          return
        }
        case e.message && e.message.includes('Invalid filename'): {
          this.error(e.message)
          return
        }
        default: {
          this.error(e)
        }
      }
    }
    // cliUx.action.stop(`Finished deploy ${results.deployId}`)

    const siteUrl = results.deploy.ssl_url || results.deploy.url
    const deployUrl = get(results, 'deploy.deploy_ssl_url') || get(results, 'deploy.deploy_url')

    const msgData = {
      Logs: `${get(results, 'deploy.admin_url')}/deploys/${get(results, 'deploy.id')}`,
      'Unique Deploy URL': deployUrl
    }

    if (deployToProduction) {
      msgData['Live URL'] = siteUrl
    } else {
      delete msgData['Unique Deploy URL']
      msgData['Live Draft URL'] = deployUrl
    }
    this.log()
    this.log(prettyjson.render(msgData))

    if (!deployToProduction) {
      console.log()
      console.log('If everything looks good on your draft URL, take it live with the --prod flag.')
      console.log(`${chalk.cyanBright.bold('netlify deploy --prod')}`)
      console.log()
    }

    if (flags['open']) {
      const urlToOpen = flags['prod'] ? siteUrl : deployUrl
      await openBrowser(urlToOpen)
      this.exit()
    }
  }
}

DeployCommand.description = `Create a new deploy from the contents of a folder

Deploys from the build settings found in the netlify.toml file, or settings from the API.

The following environment variables can be used to override configuration file lookups and prompts:

- \`NETLIFY_AUTH_TOKEN\` - an access token to use when authenticating commands. KEEP THIS VALUE PRIVATE
- \`NETLIFY_SITE_ID\` - override any linked site in the current working directory.
`

DeployCommand.examples = [
  'netlify deploy',
  'netlify deploy --prod',
  'netlify deploy --prod --open',
  'netlify deploy --message "A message with an $ENV_VAR"'
]

DeployCommand.flags = {
  dir: flags.string({
    char: 'd',
    description: 'Specify a folder to deploy'
  }),
  functions: flags.string({
    char: 'f',
    description: 'Specify a functions folder to deploy'
  }),
  prod: flags.boolean({
    char: 'p',
    description: 'Deploy to production',
    default: false
  }),
  open: flags.boolean({
    char: 'o',
    description: 'Open site after deploy',
    default: false
  }),
  message: flags.string({
    char: 'm',
    description: 'A short message to include in the deploy log'
  }),
  auth: flags.string({
    char: 'a',
    description: 'An auth token to log in with',
    env: 'NETLIFY_AUTH_TOKEN'
  }),
  site: flags.string({
    char: 's',
    description: 'A site ID to deploy to',
    env: 'NETLIFY_SITE_ID'
  })
}

function deployProgressCb() {
  const events = {}
  /* statusObj: {
            type: name-of-step
            msg: msg to print
            phase: [start, progress, stop]
    }
  */
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
      exit(1)
    }

    // Improve the message of permission errors
    if (e.code === 'EACCES') {
      console.log('Permission error when trying to access deploy folder')
      exit(1)
    }
    throw e
  }
  if (!stat.isDirectory) {
    console.log('Deploy target must be a directory')
    exit(1)
  }
  return stat
}

module.exports = DeployCommand
