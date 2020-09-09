const Command = require('../utils/command')
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
const isObject = require('lodash.isobject')
const SitesCreateCommand = require('./sites/create')
const LinkCommand = require('./link')
const { NETLIFYDEV, NETLIFYDEVLOG, NETLIFYDEVERR } = require('../utils/logo')

class DeployCommand extends Command {
  async run() {
    const { flags } = this.parse(DeployCommand)
    const { api, site, config } = this.netlify
    const alias = flags.alias || flags.branch

    if (flags.branch) {
      this.warn('--branch flag has been renamed to --alias and will be removed in future versions')
    }

    const deployToProduction = flags.prod
    if (deployToProduction && alias) {
      this.error(`--prod and --alias flags cannot be used at the same time`)
    }
    await this.authenticate(flags.auth)

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'deploy',
        open: flags.open,
        prod: flags.prod,
        json: flags.json,
        alias: Boolean(alias),
      },
    })

    let siteId = flags.site || site.id
    let siteData = {}
    if (!siteId) {
      this.log("This folder isn't linked to a site yet")
      const NEW_SITE = '+  Create & configure a new site'
      const EXISTING_SITE = 'Link this directory to an existing site'

      const initializeOpts = [EXISTING_SITE, NEW_SITE]

      const { initChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'initChoice',
          message: 'What would you like to do?',
          choices: initializeOpts,
        },
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
        site.id = siteData.id
        siteId = site.id
      }
    } else {
      try {
        siteData = await api.getSite({ siteId })
      } catch (e) {
        // TODO specifically handle known cases (e.g. no account access)
        if (e.status === 404) {
          this.error('Site not found')
        } else {
          this.error(e.message)
        }
      }
    }

    if (flags.trigger) {
      try {
        const siteBuild = await api.createSiteBuild({ siteId })
        this.log(
          `${NETLIFYDEV} A new deployment was triggered successfully. Visit https://app.netlify.com/sites/${siteData.name}/deploys/${siteBuild.deploy_id} to see the logs.`
        )
        return
      } catch (err) {
        if (err.status === 404) {
          this.error('Site not found. Please rerun "netlify link" and make sure that your site has CI configured.')
        } else {
          this.error(err.message)
        }
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
    // Support "functions" and "Functions"
    const funcConfig = get(config, 'build.functions') || get(config, 'build.Functions')
    if (flags['functions']) {
      functionsFolder = path.resolve(process.cwd(), flags['functions'])
    } else if (funcConfig) {
      functionsFolder = path.resolve(site.root, funcConfig)
    } else if (get(siteData, 'build_settings.functions_dir')) {
      functionsFolder = path.resolve(site.root, get(siteData, 'build_settings.functions_dir'))
    }

    if (!deployFolder) {
      this.log('Please provide a publish directory (e.g. "public" or "dist" or "."):')
      this.log(process.cwd())
      const { promptPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'promptPath',
          message: 'Publish directory',
          default: '.',
          filter: input => path.resolve(process.cwd(), input),
        },
      ])
      deployFolder = promptPath
    }

    const pathInfo = {
      'Deploy path': deployFolder,
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

    ensureDirectory(deployFolder, this.error)

    if (functionsFolder) {
      // we used to hard error if functions folder is specified but doesnt exist
      // but this was too strict for onboarding. we can just log a warning.
      let stat
      try {
        stat = fs.statSync(functionsFolder)
      } catch (e) {
        if (e.code === 'ENOENT') {
          console.log(
            `Functions folder "${functionsFolder}" specified but it doesn't exist! Will proceed without deploying functions`
          )
          functionsFolder = undefined
        }
        // Improve the message of permission errors
        if (e.code === 'EACCES') {
          console.log('Permission error when trying to access functions directory')
          this.exit(1)
        }
      }
      if (functionsFolder && !stat.isDirectory) {
        console.log('Deploy target must be a directory')
        this.exit(1)
      }
    }

    let results
    try {
      if (deployToProduction) {
        if (isObject(siteData.published_deploy) && siteData.published_deploy.locked) {
          this.log(`\n${NETLIFYDEVERR} Deployments are "locked" for production context of this site\n`)
          const { unlockChoice } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'unlockChoice',
              message: 'Would you like to "unlock" deployments for production context to proceed?',
              default: false,
            },
          ])
          if (!unlockChoice) this.exit(0)
          await api.unlockDeploy({ deploy_id: siteData.published_deploy.id })
          this.log(`\n${NETLIFYDEVLOG} "Auto publishing" has been enabled for production context\n`)
        }
        this.log('Deploying to main site URL...')
      } else {
        this.log('Deploying to draft URL...')
      }

      results = await api.deploy(siteId, deployFolder, {
        configPath,
        fnDir: functionsFolder,
        statusCb: flags.json || flags.silent ? () => {} : deployProgressCb(),
        draft: !deployToProduction && !alias,
        message: flags.message,
        deployTimeout: flags.timeout * 1000 || 1.2e6,
        syncFileLimit: 100,
        branch: alias,
      })
    } catch (e) {
      switch (true) {
        case e.name === 'JSONHTTPError': {
          this.warn(`JSONHTTPError: ${e.json.message} ${e.status}`)
          this.warn(`\n${JSON.stringify(e, null, '  ')}\n`)
          this.error(e)
          return
        }
        case e.name === 'TextHTTPError': {
          this.warn(`TextHTTPError: ${e.status}`)
          this.warn(`\n${e}\n`)
          this.error(e)
          return
        }
        case e.message && e.message.includes('Invalid filename'): {
          this.warn(e.message)
          this.error(e)
          return
        }
        default: {
          this.warn(`\n${JSON.stringify(e, null, '  ')}\n`)
          this.error(e)
          return
        }
      }
    }
    // cliUx.action.stop(`Finished deploy ${results.deployId}`)

    const siteUrl = results.deploy.ssl_url || results.deploy.url
    const deployUrl = get(results, 'deploy.deploy_ssl_url') || get(results, 'deploy.deploy_url')

    const logsUrl = `${get(results, 'deploy.admin_url')}/deploys/${get(results, 'deploy.id')}`
    const msgData = {
      'Logs': `${logsUrl}`,
      'Unique Deploy URL': deployUrl,
    }

    if (deployToProduction) {
      msgData['Website URL'] = siteUrl
    } else {
      delete msgData['Unique Deploy URL']
      msgData['Website Draft URL'] = deployUrl
    }

    // Spacer
    this.log()

    // Json response for piping commands
    if (flags.json && results) {
      const jsonData = {
        name: results.deploy.deployId,
        site_id: results.deploy.site_id,
        site_name: results.deploy.name,
        deploy_id: results.deployId,
        deploy_url: deployUrl,
        logs: logsUrl,
      }
      if (deployToProduction) {
        jsonData.url = siteUrl
      }

      this.logJson(jsonData)
      return false
    }

    this.log(prettyjson.render(msgData))

    if (!deployToProduction) {
      this.log()
      this.log('If everything looks good on your draft URL, deploy it to your main site URL with the --prod flag.')
      this.log(`${chalk.cyanBright.bold('netlify deploy --prod')}`)
      this.log()
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

- \`NETLIFY_AUTH_TOKEN\` - an access token to use when authenticating commands. Keep this value private.
- \`NETLIFY_SITE_ID\` - override any linked site in the current working directory.

Lambda functions in the function folder can be in the following configurations for deployment:


Built Go binaries:
------------------

\`\`\`
functions/
└── nameOfGoFunction
\`\`\`

Build binaries of your Go language functions into the functions folder as part of your build process.


Single file Node.js functions:
-----------------------------

Build dependency bundled Node.js lambda functions with tools like netlify-lambda, webpack or browserify into the function folder as part of your build process.

\`\`\`
functions/
└── nameOfBundledNodeJSFunction.js
\`\`\`

Unbundled Node.js functions that have dependencies outside or inside of the functions folder:
---------------------------------------------------------------------------------------------

You can ship unbundled Node.js functions with the CLI, utilizing top level project dependencies, or a nested package.json.
If you use nested dependencies, be sure to populate the nested node_modules as part of your build process before deploying using npm or yarn.

\`\`\`
project/
├── functions
│   ├── functionName/
│   │   ├── functionName.js  (Note the folder and the function name need to match)
│   │   ├── package.json
│   │   └── node_modules/
│   └── unbundledFunction.js
├── package.json
├── netlify.toml
└── node_modules/
\`\`\`

Any mix of these configurations works as well.


Node.js function entry points
-----------------------------

Function entry points are determined by the file name and name of the folder they are in:

\`\`\`
functions/
├── aFolderlessFunctionEntrypoint.js
└── functionName/
    ├── notTheEntryPoint.js
    └── functionName.js
\`\`\`

Support for package.json's main field, and intrinsic index.js entrypoints are coming soon.
`

DeployCommand.examples = [
  'netlify deploy',
  'netlify deploy --prod',
  'netlify deploy --prod --open',
  'netlify deploy --message "A message with an $ENV_VAR"',
  'netlify deploy --auth $NETLIFY_AUTH_TOKEN',
  'netlify deploy --trigger',
]

DeployCommand.flags = {
  dir: flags.string({
    char: 'd',
    description: 'Specify a folder to deploy',
  }),
  functions: flags.string({
    char: 'f',
    description: 'Specify a functions folder to deploy',
  }),
  prod: flags.boolean({
    char: 'p',
    description: 'Deploy to production',
    default: false,
  }),
  alias: flags.string({
    description: "Specifies the alias for deployment. Useful for creating predictable deployment URL's",
  }),
  branch: flags.string({
    char: 'b',
    description: 'Serves the same functionality as --alias. Deprecated and will be removed in future versions',
  }),
  open: flags.boolean({
    char: 'o',
    description: 'Open site after deploy',
    default: false,
  }),
  message: flags.string({
    char: 'm',
    description: 'A short message to include in the deploy log',
  }),
  auth: flags.string({
    char: 'a',
    description: 'Netlify auth token to deploy with',
    env: 'NETLIFY_AUTH_TOKEN',
  }),
  site: flags.string({
    char: 's',
    description: 'A site ID to deploy to',
    env: 'NETLIFY_SITE_ID',
  }),
  json: flags.boolean({
    description: 'Output deployment data as JSON',
  }),
  timeout: flags.integer({
    description: 'Timeout to wait for deployment to finish',
  }),
  trigger: flags.boolean({
    description: 'Trigger a new build of your site on Netlify without uploading local files',
  }),
  ...DeployCommand.flags,
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
          spinner,
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

function ensureDirectory(resolvedDeployPath, error) {
  let stat
  try {
    stat = fs.statSync(resolvedDeployPath)
  } catch (e) {
    if (e.status === 'ENOENT') {
      return error(
        `No such directory ${resolvedDeployPath}! Did you forget to create a functions folder or run a build?`
      )
    }

    // Improve the message of permission errors
    if (e.status === 'EACCES') {
      return error('Permission error when trying to access deploy folder')
    }
    throw e
  }
  if (!stat.isDirectory) {
    return error('Deploy target must be a directory')
  }
  return stat
}

module.exports = DeployCommand
