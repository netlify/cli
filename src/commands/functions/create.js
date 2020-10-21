const fs = require('fs')
const path = require('path')
const copy = require('copy-template-dir')
const { flags: flagsLib } = require('@oclif/command')
const inquirer = require('inquirer')
const fetch = require('node-fetch')
const cp = require('child_process')
const ora = require('ora')
const chalk = require('chalk')

const { mkdirRecursiveSync } = require('../../lib/fs')
const Command = require('../../utils/command')
const { readRepoURL, validateRepoURL } = require('../../utils/read-repo-url')
const { addEnvVariables } = require('../../utils/dev')
const {
  // NETLIFYDEV,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  NETLIFYDEVERR,
} = require('../../utils/logo')
const { getSiteData, getAddons, getCurrentAddon } = require('../../utils/addons/prepare')
const templatesDir = path.resolve(__dirname, '../../functions-templates')

/**
 * Be very clear what is the SOURCE (templates dir) vs the DEST (functions dir)
 */
class FunctionsCreateCommand extends Command {
  async run() {
    const { flags, args } = this.parse(FunctionsCreateCommand)
    const { config } = this.netlify
    const functionsDir = ensureFunctionDirExists(this, flags, config)

    /* either download from URL or scaffold from template */
    const mainFunc = flags.url ? downloadFromURL : scaffoldFromTemplate
    await mainFunc(this, flags, args, functionsDir)
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
  name: flagsLib.string({ char: 'n', description: 'function name' }),
  url: flagsLib.string({ char: 'u', description: 'pull template from URL' }),
  ...FunctionsCreateCommand.flags,
}
module.exports = FunctionsCreateCommand

/**
 * all subsections of code called from the main logic flow above
 */

// prompt for a name if name not supplied
async function getNameFromArgs(args, flags, defaultName) {
  if (flags.name) {
    if (args.name) {
      throw new Error('function name specified in both flag and arg format, pick one')
    }
    return flags.name
  }

  if (args.name) {
    return args.name
  }

  const { name } = await inquirer.prompt([
    {
      name: 'name',
      message: 'name your function: ',
      default: defaultName,
      type: 'input',
      validate: (val) => Boolean(val) && /^[\w.-]+$/i.test(val),
      // make sure it is not undefined and is a valid filename.
      // this has some nuance i have ignored, eg crossenv and i18n concerns
    },
  ])
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
    source(answersSoFar, input) {
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
    const temp = registry.map((x) => x.name + x.description)
    const filteredTemplates = fuzzy.filter(input, temp)
    const filteredTemplateNames = new Set(filteredTemplates.map((x) => (input ? x.string : x)))
    return registry
      .filter((t) => filteredTemplateNames.has(t.name + t.description))
      .map((t) => {
        // add the score
        const { score } = filteredTemplates.find((f) => f.string === t.name + t.description)
        t.score = score
        return t
      })
  }
  function formatRegistryArrayForInquirer(lang) {
    const folderNames = fs.readdirSync(path.join(templatesDir, lang))
    const registry = folderNames
      .filter((x) => !x.endsWith('.md')) // filter out markdown files
      .map((name) => require(path.join(templatesDir, lang, name, '.netlify-function-template.js')))
      .sort((a, b) => (a.priority || DEFAULT_PRIORITY) - (b.priority || DEFAULT_PRIORITY))
      .map((t) => {
        t.lang = lang
        return {
          // confusing but this is the format inquirer wants
          name: `[${t.name}] ${t.description}`,
          value: t,
          short: `${lang}-${t.name}`,
        }
      })
    return registry
  }
}

const DEFAULT_PRIORITY = 999

/* get functions dir (and make it if necessary) */
function ensureFunctionDirExists(context, flags, config) {
  const functionsDir = config.build && config.build.functions
  if (!functionsDir) {
    context.log(`${NETLIFYDEVLOG} No functions folder specified in netlify.toml`)
    process.exit(1)
  }
  if (!fs.existsSync(functionsDir)) {
    context.log(
      `${NETLIFYDEVLOG} functions folder ${chalk.magenta.inverse(
        functionsDir,
      )} specified in netlify.toml but folder not found, creating it...`,
    )
    fs.mkdirSync(functionsDir)
    context.log(`${NETLIFYDEVLOG} functions folder ${chalk.magenta.inverse(functionsDir)} created`)
  }
  return functionsDir
}

// Download files from a given github URL
async function downloadFromURL(context, flags, args, functionsDir) {
  const folderContents = await readRepoURL(flags.url)
  const [functionName] = flags.url.split('/').slice(-1)
  const nameToUse = await getNameFromArgs(args, flags, functionName)
  const fnFolder = path.join(functionsDir, nameToUse)
  if (fs.existsSync(`${fnFolder}.js`) && fs.lstatSync(`${fnFolder}.js`).isFile()) {
    context.log(
      `${NETLIFYDEVWARN}: A single file version of the function ${nameToUse} already exists at ${fnFolder}.js. Terminating without further action.`,
    )
    process.exit(1)
  }

  try {
    mkdirRecursiveSync(fnFolder)
  } catch (error) {
    // Ignore
  }
  await Promise.all(
    folderContents.map(({ name, download_url: downloadUrl }) => {
      return fetch(downloadUrl)
        .then((res) => {
          const finalName = path.basename(name, '.js') === functionName ? `${nameToUse}.js` : name
          const dest = fs.createWriteStream(path.join(fnFolder, finalName))
          res.body.pipe(dest)
        })
        .catch((error) => {
          throw new Error(`Error while retrieving ${downloadUrl} ${error}`)
        })
    }),
  )

  context.log(`${NETLIFYDEVLOG} Installing dependencies for ${nameToUse}...`)
  cp.exec('npm i', { cwd: path.join(functionsDir, nameToUse) }, () => {
    context.log(`${NETLIFYDEVLOG} Installing dependencies for ${nameToUse} complete `)
  })

  // read, execute, and delete function template file if exists
  const fnTemplateFile = path.join(fnFolder, '.netlify-function-template.js')
  if (fs.existsSync(fnTemplateFile)) {
    const { onComplete, addons = [] } = require(fnTemplateFile)

    await installAddons(context, addons, path.resolve(fnFolder))
    if (onComplete) {
      await addEnvVariables(context.netlify.api, context.netlify.site)
      await onComplete.call(context)
    }
    fs.unlinkSync(fnTemplateFile) // delete
  }
}

function installDeps(functionPath) {
  return new Promise((resolve) => {
    cp.exec('npm i', { cwd: path.join(functionPath) }, () => {
      resolve()
    })
  })
}

// no --url flag specified, pick from a provided template
async function scaffoldFromTemplate(context, flags, args, functionsDir) {
  const chosentemplate = await pickTemplate() // pull the rest of the metadata from the template
  if (chosentemplate === 'url') {
    const { chosenurl } = await inquirer.prompt([
      {
        name: 'chosenurl',
        message: 'URL to clone: ',
        type: 'input',
        validate: (val) => Boolean(validateRepoURL(val)),
        // make sure it is not undefined and is a valid filename.
        // this has some nuance i have ignored, eg crossenv and i18n concerns
      },
    ])
    flags.url = chosenurl.trim()
    try {
      await downloadFromURL(context, flags, args, functionsDir)
    } catch (error) {
      context.error(`$${NETLIFYDEVERR} Error downloading from URL: ${flags.url}`)
      context.error(error)
      process.exit(1)
    }
  } else if (chosentemplate === 'report') {
    context.log(`${NETLIFYDEVLOG} Open in browser: https://github.com/netlify/cli/issues/new`)
  } else {
    const { onComplete, name: templateName, lang, addons = [] } = chosentemplate

    const pathToTemplate = path.join(templatesDir, lang, templateName)
    if (!fs.existsSync(pathToTemplate)) {
      throw new Error(
        `there isnt a corresponding folder to the selected name, ${templateName} template is misconfigured`,
      )
    }

    const name = await getNameFromArgs(args, flags, templateName)
    context.log(`${NETLIFYDEVLOG} Creating function ${chalk.cyan.inverse(name)}`)
    const functionPath = ensureFunctionPathIsOk(context, functionsDir, name)

    // // SWYX: note to future devs - useful for debugging source to output issues
    // this.log('from ', pathToTemplate, ' to ', functionPath)
    const vars = { NETLIFY_STUFF_TO_REPLACE: 'REPLACEMENT' } // SWYX: TODO
    let hasPackageJSON = false
    copy(pathToTemplate, functionPath, vars, async (err, createdFiles) => {
      if (err) throw err
      createdFiles.forEach((filePath) => {
        if (filePath.endsWith('.netlify-function-template.js')) return
        context.log(`${NETLIFYDEVLOG} ${chalk.greenBright('Created')} ${filePath}`)
        require('fs').chmodSync(path.resolve(filePath), TEMPLATE_PERMISSIONS)
        if (filePath.includes('package.json')) hasPackageJSON = true
      })
      // delete function template file that was copied over by copydir
      fs.unlinkSync(path.join(functionPath, '.netlify-function-template.js'))
      // rename the root function file if it has a different name from default
      if (name !== templateName) {
        fs.renameSync(path.join(functionPath, `${templateName}.js`), path.join(functionPath, `${name}.js`))
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

      await installAddons(context, addons, path.resolve(functionPath))
      if (onComplete) {
        await addEnvVariables(context.netlify.api, context.netlify.site)
        await onComplete.call(context)
      }
    })
  }
}

const TEMPLATE_PERMISSIONS = 0o777

async function createFunctionAddon({ api, addons, siteId, addonName, siteData, log, error }) {
  try {
    const addon = getCurrentAddon({ addons, addonName })
    if (addon && addon.id) {
      log(`The "${addonName} add-on" already exists for ${siteData.name}`)
      return false
    }
    await api.createServiceInstance({
      siteId,
      addon: addonName,
      body: { config: {} },
    })
    log(`Add-on "${addonName}" created for ${siteData.name}`)
    return true
  } catch (error_) {
    error(error_.message)
  }
}

async function installAddons(context, functionAddons = [], fnPath) {
  if (functionAddons.length === 0) {
    return
  }

  const { log, error } = context
  const { api, site } = context.netlify
  const siteId = site.id
  if (!siteId) {
    log('No site id found, please run inside a site folder or `netlify link`')
    return false
  }
  log(`${NETLIFYDEVLOG} checking Netlify APIs...`)

  const [siteData, siteAddons] = await Promise.all([
    getSiteData({ api, siteId, error }),
    getAddons({ api, siteId, error }),
  ])

  const arr = functionAddons.map(async ({ addonName, addonDidInstall }) => {
    log(`${NETLIFYDEVLOG} installing addon: ${chalk.yellow.inverse(addonName)}`)
    try {
      const addonCreated = await createFunctionAddon({
        api,
        addons: siteAddons,
        siteId,
        addonName,
        siteData,
        log,
        error,
      })
      if (addonCreated && addonDidInstall) {
        await addEnvVariables(api, site)
        const { confirmPostInstall } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmPostInstall',
            message: `This template has an optional setup script that runs after addon install. This can be helpful for first time users to try out templates. Run the script?`,
            default: false,
          },
        ])
        if (confirmPostInstall) {
          addonDidInstall(fnPath)
        }
      }
    } catch (error_) {
      error(`${NETLIFYDEVERR} Error installing addon: `, error_)
    }
  })
  return Promise.all(arr)
}

// we used to allow for a --dir command,
// but have retired that to force every scaffolded function to be a folder
function ensureFunctionPathIsOk(context, functionsDir, name) {
  const functionPath = path.join(functionsDir, name)
  if (fs.existsSync(functionPath)) {
    context.log(`${NETLIFYDEVLOG} Function ${functionPath} already exists, cancelling...`)
    process.exit(1)
  }
  return functionPath
}
