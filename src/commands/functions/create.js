const fs = require('fs-extra')
const path = require('path')
const copy = require('copy-template-dir')
const { flags } = require('@oclif/command')
const Command = require('../../utils/command')
const inquirer = require('inquirer')
const { readRepoURL, validateRepoURL } = require('../../utils/read-repo-url')
const { addEnvVariables } = require('../../utils/dev')
const { createSiteAddon } = require('../../utils/addons')
const fetch = require('node-fetch')
const cp = require('child_process')
const ora = require('ora')
const chalk = require('chalk')
const {
  // NETLIFYDEV,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  NETLIFYDEVERR,
} = require('../../utils/logo')

const templatesDir = path.resolve(__dirname, '../../functions-templates')

/**
 * Be very clear what is the SOURCE (templates dir) vs the DEST (functions dir)
 */
class FunctionsCreateCommand extends Command {
  async run() {
    const { flags, args } = this.parse(FunctionsCreateCommand)
    const { config } = this.netlify
    const functionsDir = ensureFunctionDirExists.call(this, flags, config)

    /* either download from URL or scaffold from template */
    if (flags.url) {
      await downloadFromURL.call(this, flags, args, functionsDir)
    } else {
      await scaffoldFromTemplate.call(this, flags, args, functionsDir)
    }
    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'functions:create',
      },
    })
  }
}

FunctionsCreateCommand.args = [
  {
    name: 'name',
    description: 'name of your new function file inside your functions folder',
  },
]

FunctionsCreateCommand.description = `Create a new function locally`

FunctionsCreateCommand.examples = [
  'netlify functions:create',
  'netlify functions:create hello-world',
  'netlify functions:create --name hello-world',
]
FunctionsCreateCommand.aliases = ['function:create']
FunctionsCreateCommand.flags = {
  name: flags.string({ char: 'n', description: 'function name' }),
  url: flags.string({ char: 'u', description: 'pull template from URL' }),
  ...FunctionsCreateCommand.flags,
}
module.exports = FunctionsCreateCommand

/**
 * all subsections of code called from the main logic flow above
 */

// prompt for a name if name not supplied
async function getNameFromArgs(args, flags, defaultName) {
  if (flags.name && args.name) throw new Error('function name specified in both flag and arg format, pick one')
  let name
  if (flags.name && !args.name) name = flags.name
  // use flag if exists
  else if (!flags.name && args.name) name = args.name

  // if neither are specified, prompt for it
  if (!name) {
    const responses = await inquirer.prompt([
      {
        name: 'name',
        message: 'name your function: ',
        default: defaultName,
        type: 'input',
        validate: val => Boolean(val) && /^[\w\-.]+$/i.test(val),
        // make sure it is not undefined and is a valid filename.
        // this has some nuance i have ignored, eg crossenv and i18n concerns
      },
    ])
    name = responses.name
  }
  return name
}

// pick template from our existing templates
async function pickTemplate() {
  // lazy loading on purpose
  inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'))
  const fuzzy = require('fuzzy')
  // doesnt scale but will be ok for now
  const [
    jsreg,
    // tsreg, goreg
  ] = [
    'js',
    // 'ts', 'go'
  ].map(formatRegistryArrayForInquirer)
  const specialCommands = [
    new inquirer.Separator(`----[Special Commands]----`),
    {
      name: `*** Clone template from Github URL ***`,
      value: 'url',
      short: 'gh-url',
    },
    {
      name: `*** Report issue with, or suggest a new template ***`,
      value: 'report',
      short: 'gh-report',
    },
  ]
  const { chosentemplate } = await inquirer.prompt({
    name: 'chosentemplate',
    message: 'Pick a template',
    type: 'autocomplete',
    // suggestOnly: true, // we can explore this for entering URL in future
    async source(answersSoFar, input) {
      if (!input || input === '') {
        // show separators
        return [
          new inquirer.Separator(`----[JS]----`),
          ...jsreg,
          // new inquirer.Separator(`----[TS]----`),
          // ...tsreg,
          // new inquirer.Separator(`----[GO]----`),
          // ...goreg
          ...specialCommands,
        ]
      }
      // only show filtered results sorted by score
      const ans = [
        ...filterRegistry(jsreg, input),
        // ...filterRegistry(tsreg, input),
        // ...filterRegistry(goreg, input)
        ...specialCommands,
      ].sort((a, b) => b.score - a.score)
      return ans
    },
  })
  return chosentemplate
  function filterRegistry(registry, input) {
    const temp = registry.map(x => x.name + x.description)
    const filteredTemplates = fuzzy.filter(input, temp)
    const filteredTemplateNames = filteredTemplates.map(x => (input ? x.string : x))
    return registry
      .filter(t => filteredTemplateNames.includes(t.name + t.description))
      .map(t => {
        // add the score
        const { score } = filteredTemplates.find(f => f.string === t.name + t.description)
        t.score = score
        return t
      })
  }
  function formatRegistryArrayForInquirer(lang) {
    const folderNames = fs.readdirSync(path.join(templatesDir, lang))
    const registry = folderNames
      .filter(x => !x.endsWith('.md')) // filter out markdown files
      .map(name => require(path.join(templatesDir, lang, name, '.netlify-function-template.js')))
      .sort((a, b) => (a.priority || 999) - (b.priority || 999))
      .map(t => {
        t.lang = lang
        return {
          // confusing but this is the format inquirer wants
          name: `[${t.name}] ` + t.description,
          value: t,
          short: lang + '-' + t.name,
        }
      })
    return registry
  }
}

/* get functions dir (and make it if necessary) */
function ensureFunctionDirExists(flags, config) {
  const functionsDir = config.build && config.build.functions
  if (!functionsDir) {
    this.log(`${NETLIFYDEVLOG} No functions folder specified in netlify.toml`)
    process.exit(1)
  }
  if (!fs.existsSync(functionsDir)) {
    this.log(
      `${NETLIFYDEVLOG} functions folder ${chalk.magenta.inverse(
        functionsDir
      )} specified in netlify.toml but folder not found, creating it...`
    )
    fs.mkdirSync(functionsDir)
    this.log(`${NETLIFYDEVLOG} functions folder ${chalk.magenta.inverse(functionsDir)} created`)
  }
  return functionsDir
}

// Download files from a given github URL
async function downloadFromURL(flags, args, functionsDir) {
  const folderContents = await readRepoURL(flags.url)
  const functionName = flags.url.split('/').slice(-1)[0]
  const nameToUse = await getNameFromArgs(args, flags, functionName)
  const fnFolder = path.join(functionsDir, nameToUse)
  if (fs.existsSync(fnFolder + '.js') && fs.lstatSync(fnFolder + '.js').isFile()) {
    this.log(
      `${NETLIFYDEVWARN}: A single file version of the function ${nameToUse} already exists at ${fnFolder}.js. Terminating without further action.`
    )
    process.exit(1)
  }

  try {
    fs.mkdirSync(fnFolder, { recursive: true })
  } catch (error) {
    // Ignore
  }
  await Promise.all(
    folderContents.map(({ name, download_url }) => {
      return fetch(download_url)
        .then(res => {
          const finalName = path.basename(name, '.js') === functionName ? nameToUse + '.js' : name
          const dest = fs.createWriteStream(path.join(fnFolder, finalName))
          res.body.pipe(dest)
        })
        .catch(error => {
          throw new Error('Error while retrieving ' + download_url + ` ${error}`)
        })
    })
  )

  this.log(`${NETLIFYDEVLOG} Installing dependencies for ${nameToUse}...`)
  cp.exec('npm i', { cwd: path.join(functionsDir, nameToUse) }, () => {
    this.log(`${NETLIFYDEVLOG} Installing dependencies for ${nameToUse} complete `)
  })

  // read, execute, and delete function template file if exists
  const fnTemplateFile = path.join(fnFolder, '.netlify-function-template.js')
  if (fs.existsSync(fnTemplateFile)) {
    const { onComplete, addons = [] } = require(fnTemplateFile)

    await installAddons.call(this, addons, path.resolve(fnFolder))
    if (onComplete) {
      await addEnvVariables(this.netlify.api, this.netlify.site)
      await onComplete.call(this)
    }
    fs.unlinkSync(fnTemplateFile) // delete
  }
}

async function installDeps(functionPath) {
  return new Promise(resolve => {
    cp.exec('npm i', { cwd: path.join(functionPath) }, () => {
      resolve()
    })
  })
}

// no --url flag specified, pick from a provided template
async function scaffoldFromTemplate(flags, args, functionsDir) {
  const chosentemplate = await pickTemplate.call(this) // pull the rest of the metadata from the template
  if (chosentemplate === 'url') {
    const { chosenurl } = await inquirer.prompt([
      {
        name: 'chosenurl',
        message: 'URL to clone: ',
        type: 'input',
        validate: val => Boolean(validateRepoURL(val)),
        // make sure it is not undefined and is a valid filename.
        // this has some nuance i have ignored, eg crossenv and i18n concerns
      },
    ])
    flags.url = chosenurl.trim()
    try {
      await downloadFromURL.call(this, flags, args, functionsDir)
    } catch (error) {
      this.error(`$${NETLIFYDEVERR} Error downloading from URL: ` + flags.url)
      this.error(error)
      process.exit(1)
    }
  } else if (chosentemplate === 'report') {
    this.log(`${NETLIFYDEVLOG} Open in browser: https://github.com/netlify/cli/issues/new`)
  } else {
    const { onComplete, name: templateName, lang, addons = [] } = chosentemplate

    const pathToTemplate = path.join(templatesDir, lang, templateName)
    if (!fs.existsSync(pathToTemplate)) {
      throw new Error(
        `there isnt a corresponding folder to the selected name, ${templateName} template is misconfigured`
      )
    }

    const name = await getNameFromArgs(args, flags, templateName)
    this.log(`${NETLIFYDEVLOG} Creating function ${chalk.cyan.inverse(name)}`)
    const functionPath = ensureFunctionPathIsOk.call(this, functionsDir, flags, name)

    // // SWYX: note to future devs - useful for debugging source to output issues
    // this.log('from ', pathToTemplate, ' to ', functionPath)
    const vars = { NETLIFY_STUFF_TO_REPLACE: 'REPLACEMENT' } // SWYX: TODO
    let hasPackageJSON = false
    copy(pathToTemplate, functionPath, vars, async (err, createdFiles) => {
      if (err) throw err
      createdFiles.forEach(filePath => {
        if (filePath.endsWith('.netlify-function-template.js')) return
        this.log(`${NETLIFYDEVLOG} ${chalk.greenBright('Created')} ${filePath}`)
        require('fs').chmodSync(path.resolve(filePath), 0o777)
        if (filePath.includes('package.json')) hasPackageJSON = true
      })
      // delete function template file that was copied over by copydir
      fs.unlinkSync(path.join(functionPath, '.netlify-function-template.js'))
      // rename the root function file if it has a different name from default
      if (name !== templateName) {
        fs.renameSync(path.join(functionPath, templateName + '.js'), path.join(functionPath, name + '.js'))
      }
      // npm install
      if (hasPackageJSON) {
        const spinner = ora({
          text: `installing dependencies for ${name}`,
          spinner: 'moon',
        }).start()
        await installDeps(functionPath)
        spinner.succeed(`installed dependencies for ${name}`)
      }

      installAddons.call(this, addons, path.resolve(functionPath))
      if (onComplete) {
        await addEnvVariables(this.netlify.api, this.netlify.site)
        await onComplete.call(this)
      }
    })
  }
}

async function installAddons(addons = [], fnPath) {
  if (addons.length > 0) {
    const { api, site } = this.netlify
    const siteId = site.id
    if (!siteId) {
      this.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }
    this.log(`${NETLIFYDEVLOG} checking Netlify APIs...`)

    return api.getSite({ siteId }).then(async siteData => {
      const accessToken = api.accessToken
      const arr = addons.map(({ addonName, addonDidInstall }) => {
        this.log(`${NETLIFYDEVLOG} installing addon: ` + chalk.yellow.inverse(addonName))
        // will prompt for configs if not supplied - we do not yet allow for addon configs supplied by `netlify functions:create` command and may never do so
        return createSiteAddon(accessToken, addonName, siteId, siteData, this.log)
          .then(async addonCreateMsg => {
            if (addonCreateMsg) {
              // spinner.success("installed addon: " + addonName);
              if (addonDidInstall) {
                const { addEnvVariables } = require('../../utils/dev')
                await addEnvVariables(api, site)
                const { confirmPostInstall } = await inquirer.prompt([
                  {
                    type: 'confirm',
                    name: 'confirmPostInstall',
                    message: `This template has an optional setup script that runs after addon install. This can be helpful for first time users to try out templates. Run the script?`,
                    default: false,
                  },
                ])
                if (confirmPostInstall) addonDidInstall(fnPath)
              }
            }
          })
          .catch(error => {
            this.error(`${NETLIFYDEVERR} Error installing addon: `, error)
          })
      })
      return Promise.all(arr)
    })
  }
}

// we used to allow for a --dir command,
// but have retired that to force every scaffolded function to be a folder
function ensureFunctionPathIsOk(functionsDir, flags, name) {
  const functionPath = path.join(functionsDir, name)
  if (fs.existsSync(functionPath)) {
    this.log(`${NETLIFYDEVLOG} Function ${functionPath} already exists, cancelling...`)
    process.exit(1)
  }
  return functionPath
}
