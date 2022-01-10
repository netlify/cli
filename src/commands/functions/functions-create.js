// @ts-check
const cp = require('child_process')
const fs = require('fs')
const { mkdir } = require('fs').promises
const path = require('path')
const process = require('process')
const { promisify } = require('util')

const copy = promisify(require('copy-template-dir'))
const findUp = require('find-up')
const fuzzy = require('fuzzy')
const inquirer = require('inquirer')
const inquirerAutocompletePrompt = require('inquirer-autocomplete-prompt')
const fetch = require('node-fetch')
const ora = require('ora')

const {
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  chalk,
  error,
  execa,

  injectEnvVariables,
  log,
  readRepoURL,
  validateRepoURL,
} = require('../../utils')
const { getAddons, getCurrentAddon, getSiteData } = require('../../utils/addons/prepare')

const templatesDir = path.resolve(__dirname, '../../functions-templates')

const showRustTemplates = process.env.NETLIFY_EXPERIMENTAL_BUILD_RUST_SOURCE === 'true'

// Ensure that there's a sub-directory in `src/functions-templates` named after
// each `value` property in this list.
const languages = [
  { name: 'JavaScript', value: 'javascript' },
  { name: 'TypeScript', value: 'typescript' },
  { name: 'Go', value: 'go' },
  showRustTemplates && { name: 'Rust', value: 'rust' },
]

/**
 * prompt for a name if name not supplied
 * @param {string} argumentName
 * @param {import('commander').OptionValues} options
 * @param {string} [defaultName]
 * @returns
 */
const getNameFromArgs = async function (argumentName, options, defaultName) {
  if (options.name) {
    if (argumentName) {
      throw new Error('function name specified in both flag and arg format, pick one')
    }
    return options.name
  }

  if (argumentName) {
    return argumentName
  }

  const { name } = await inquirer.prompt([
    {
      name: 'name',
      message: 'Name your function:',
      default: defaultName,
      type: 'input',
      validate: (val) => Boolean(val) && /^[\w.-]+$/i.test(val),
      // make sure it is not undefined and is a valid filename.
      // this has some nuance i have ignored, eg crossenv and i18n concerns
    },
  ])
  return name
}

const filterRegistry = function (registry, input) {
  const temp = registry.map((value) => value.name + value.description)
  // TODO: remove once https://github.com/sindresorhus/eslint-plugin-unicorn/issues/1394 is fixed
  // eslint-disable-next-line unicorn/no-array-method-this-argument
  const filteredTemplates = fuzzy.filter(input, temp)
  const filteredTemplateNames = new Set(
    filteredTemplates.map((filteredTemplate) => (input ? filteredTemplate.string : filteredTemplate)),
  )
  return registry
    .filter((t) => filteredTemplateNames.has(t.name + t.description))
    .map((t) => {
      // add the score
      const { score } = filteredTemplates.find((filteredTemplate) => filteredTemplate.string === t.name + t.description)
      t.score = score
      return t
    })
}

const formatRegistryArrayForInquirer = function (lang) {
  const folderNames = fs.readdirSync(path.join(templatesDir, lang))
  const registry = folderNames
    // filter out markdown files
    .filter((folderName) => !folderName.endsWith('.md'))
    // eslint-disable-next-line node/global-require, import/no-dynamic-require
    .map((folderName) => require(path.join(templatesDir, lang, folderName, '.netlify-function-template.js')))
    .sort((folderNameA, folderNameB) => {
      const priorityDiff = (folderNameA.priority || DEFAULT_PRIORITY) - (folderNameB.priority || DEFAULT_PRIORITY)

      if (priorityDiff !== 0) {
        return priorityDiff
      }

      // This branch is needed because `Array.prototype.sort` was not stable
      // until Node 11, so the original sorting order from `fs.readdirSync`
      // was not respected. We can simplify this once we drop support for
      // Node 10.
      return folderNameA - folderNameB
    })
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

/**
 * pick template from our existing templates
 * @param {import('commander').OptionValues} config
 */
const pickTemplate = async function ({ language: languageFromFlag }) {
  const specialCommands = [
    new inquirer.Separator(),
    {
      name: `Clone template from GitHub URL`,
      value: 'url',
      short: 'gh-url',
    },
    {
      name: `Report issue with, or suggest a new template`,
      value: 'report',
      short: 'gh-report',
    },
    new inquirer.Separator(),
  ]

  let language = languageFromFlag

  if (language === undefined) {
    const { language: languageFromPrompt } = await inquirer.prompt({
      choices: languages.filter(Boolean),
      message: 'Select the language of your function',
      name: 'language',
      type: 'list',
    })

    language = languageFromPrompt
  }

  inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt)

  let templatesForLanguage

  try {
    templatesForLanguage = formatRegistryArrayForInquirer(language)
  } catch {
    throw error(`Invalid language: ${language}`)
  }

  const { chosenTemplate } = await inquirer.prompt({
    name: 'chosenTemplate',
    message: 'Pick a template',
    type: 'autocomplete',
    source(answersSoFar, input) {
      if (!input || input === '') {
        // show separators
        return [...templatesForLanguage, ...specialCommands]
      }
      // only show filtered results sorted by score
      const answers = [...filterRegistry(templatesForLanguage, input), ...specialCommands].sort(
        (answerA, answerB) => answerB.score - answerA.score,
      )
      return answers
    },
  })
  return chosenTemplate
}

const DEFAULT_PRIORITY = 999

/**
 * Get functions directory (and make it if necessary)
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<string|never>} - functions directory or throws an error
 */
const ensureFunctionDirExists = async function (command) {
  const { api, config, site } = command.netlify
  const siteId = site.id
  let functionsDirHolder = config.functionsDirectory

  if (!functionsDirHolder) {
    log(`${NETLIFYDEVLOG} functions directory not specified in netlify.toml or UI settings`)

    if (!siteId) {
      error(`${NETLIFYDEVERR} No site id found, please run inside a site directory or \`netlify link\``)
    }

    const { functionsDir } = await inquirer.prompt([
      {
        type: 'input',
        name: 'functionsDir',
        message:
          'Enter the path, relative to your site’s base directory in your repository, where your functions should live:',
        default: 'netlify/functions',
      },
    ])

    functionsDirHolder = functionsDir

    try {
      log(`${NETLIFYDEVLOG} updating site settings with ${chalk.magenta.inverse(functionsDirHolder)}`)

      // @ts-ignore Typings of API are not correct
      await api.updateSite({
        siteId: site.id,
        body: {
          build_settings: {
            functions_dir: functionsDirHolder,
          },
        },
      })

      log(`${NETLIFYDEVLOG} functions directory ${chalk.magenta.inverse(functionsDirHolder)} updated in site settings`)
    } catch {
      throw error('Error updating site settings')
    }
  }

  if (!fs.existsSync(functionsDirHolder)) {
    log(
      `${NETLIFYDEVLOG} functions directory ${chalk.magenta.inverse(
        functionsDirHolder,
      )} does not exist yet, creating it...`,
    )

    fs.mkdirSync(functionsDirHolder, { recursive: true })

    log(`${NETLIFYDEVLOG} functions directory ${chalk.magenta.inverse(functionsDirHolder)} created`)
  }

  return functionsDirHolder
}

/**
 * Download files from a given GitHub URL
 * @param {import('../base-command').BaseCommand} command
 * @param {import('commander').OptionValues} options
 * @param {string} argumentName
 * @param {string} functionsDir
 */
const downloadFromURL = async function (command, options, argumentName, functionsDir) {
  const folderContents = await readRepoURL(options.url)
  const [functionName] = options.url.split('/').slice(-1)
  const nameToUse = await getNameFromArgs(argumentName, options, functionName)

  const fnFolder = path.join(functionsDir, nameToUse)
  if (fs.existsSync(`${fnFolder}.js`) && fs.lstatSync(`${fnFolder}.js`).isFile()) {
    log(
      `${NETLIFYDEVWARN}: A single file version of the function ${nameToUse} already exists at ${fnFolder}.js. Terminating without further action.`,
    )
    process.exit(1)
  }

  try {
    await mkdir(fnFolder, { recursive: true })
  } catch {
    // Ignore
  }
  await Promise.all(
    folderContents.map(async ({ download_url: downloadUrl, name }) => {
      try {
        const res = await fetch(downloadUrl)
        const finalName = path.basename(name, '.js') === functionName ? `${nameToUse}.js` : name
        const dest = fs.createWriteStream(path.join(fnFolder, finalName))
        res.body.pipe(dest)
      } catch (error_) {
        throw new Error(`Error while retrieving ${downloadUrl} ${error_}`)
      }
    }),
  )

  log(`${NETLIFYDEVLOG} Installing dependencies for ${nameToUse}...`)
  cp.exec('npm i', { cwd: path.join(functionsDir, nameToUse) }, () => {
    log(`${NETLIFYDEVLOG} Installing dependencies for ${nameToUse} complete `)
  })

  // read, execute, and delete function template file if exists
  const fnTemplateFile = path.join(fnFolder, '.netlify-function-template.js')
  if (fs.existsSync(fnTemplateFile)) {
    // eslint-disable-next-line node/global-require, import/no-dynamic-require
    const { onComplete, addons = [] } = require(fnTemplateFile)

    await installAddons(command, addons, path.resolve(fnFolder))
    await handleOnComplete({ command, onComplete })
    // delete
    fs.unlinkSync(fnTemplateFile)
  }
}

// Takes a list of existing packages and a list of packages required by a
// function, and returns the packages from the latter that aren't present
// in the former. The packages are returned as an array of strings with the
// name and version range (e.g. '@netlify/functions@0.1.0').
const getNpmInstallPackages = (existingPackages = {}, neededPackages = {}) =>
  Object.entries(neededPackages)
    .filter(([name]) => existingPackages[name] === undefined)
    .map(([name, version]) => `${name}@${version}`)

// When installing a function's dependencies, we first try to find a site-level
// `package.json` file. If we do, we look for any dependencies of the function
// that aren't already listed as dependencies of the site and install them. If
// we don't do this check, we may be upgrading the version of a module used in
// another part of the project, which we don't want to do.
const installDeps = async ({ functionPackageJson, functionPath, functionsDir }) => {
  // eslint-disable-next-line import/no-dynamic-require, node/global-require
  const { dependencies: functionDependencies, devDependencies: functionDevDependencies } = require(functionPackageJson)
  const sitePackageJson = await findUp('package.json', { cwd: functionsDir })
  const npmInstallFlags = ['--no-audit', '--no-fund']

  // If there is no site-level `package.json`, we fall back to the old behavior
  // of keeping that file in the function directory and running `npm install`
  // from there.
  if (!sitePackageJson) {
    await execa('npm', ['i', ...npmInstallFlags], { cwd: functionPath })

    return
  }

  // eslint-disable-next-line import/no-dynamic-require, node/global-require
  const { dependencies: siteDependencies, devDependencies: siteDevDependencies } = require(sitePackageJson)
  const dependencies = getNpmInstallPackages(siteDependencies, functionDependencies)
  const devDependencies = getNpmInstallPackages(siteDevDependencies, functionDevDependencies)
  const npmInstallPath = path.dirname(sitePackageJson)

  if (dependencies.length !== 0) {
    await execa('npm', ['i', ...dependencies, '--save', ...npmInstallFlags], { cwd: npmInstallPath })
  }

  if (devDependencies.length !== 0) {
    await execa('npm', ['i', ...devDependencies, '--save-dev', ...npmInstallFlags], { cwd: npmInstallPath })
  }

  // We installed the function's dependencies in the site-level `package.json`,
  // so there's no reason to keep the one copied over from the template.
  fs.unlinkSync(functionPackageJson)

  // Similarly, if the template has a `package-lock.json` file, we delete it.
  try {
    const functionPackageLock = path.join(functionPath, 'package-lock.json')

    fs.unlinkSync(functionPackageLock)
  } catch {
    // no-op
  }
}

/**
 * no --url flag specified, pick from a provided template
 * @param {import('../base-command').BaseCommand} command
 * @param {import('commander').OptionValues} options
 * @param {string} argumentName
 * @param {string} functionsDir
 */
const scaffoldFromTemplate = async function (command, options, argumentName, functionsDir) {
  // pull the rest of the metadata from the template
  const chosenTemplate = await pickTemplate(options)
  if (chosenTemplate === 'url') {
    const { chosenUrl } = await inquirer.prompt([
      {
        name: 'chosenUrl',
        message: 'URL to clone: ',
        type: 'input',
        validate: (val) => Boolean(validateRepoURL(val)),
        // make sure it is not undefined and is a valid filename.
        // this has some nuance i have ignored, eg crossenv and i18n concerns
      },
    ])
    options.url = chosenUrl.trim()
    try {
      await downloadFromURL(command, options, argumentName, functionsDir)
    } catch (error_) {
      error(`$${NETLIFYDEVERR} Error downloading from URL: ${options.url}`)
      error(error_)
      process.exit(1)
    }
  } else if (chosenTemplate === 'report') {
    log(`${NETLIFYDEVLOG} Open in browser: https://github.com/netlify/cli/issues/new`)
  } else {
    const { onComplete, name: templateName, lang, addons = [] } = chosenTemplate

    const pathToTemplate = path.join(templatesDir, lang, templateName)
    if (!fs.existsSync(pathToTemplate)) {
      throw new Error(
        `There isn't a corresponding directory to the selected name. Template '${templateName}' is misconfigured`,
      )
    }

    const name = await getNameFromArgs(argumentName, options, templateName)

    log(`${NETLIFYDEVLOG} Creating function ${chalk.cyan.inverse(name)}`)
    const functionPath = ensureFunctionPathIsOk(functionsDir, name)

    const vars = { name }
    let functionPackageJson

    // These files will not be part of the log message because they'll likely
    // be removed before the command finishes.
    const omittedFromOutput = new Set(['.netlify-function-template.js', 'package.json', 'package-lock.json'])
    const createdFiles = await copy(pathToTemplate, functionPath, vars)
    createdFiles.forEach((filePath) => {
      const filename = path.basename(filePath)

      if (!omittedFromOutput.has(filename)) {
        log(`${NETLIFYDEVLOG} ${chalk.greenBright('Created')} ${filePath}`)
      }

      fs.chmodSync(path.resolve(filePath), TEMPLATE_PERMISSIONS)
      if (filePath.includes('package.json')) {
        functionPackageJson = path.resolve(filePath)
      }
    })

    // delete function template file that was copied over by copydir
    fs.unlinkSync(path.join(functionPath, '.netlify-function-template.js'))

    // npm install
    if (functionPackageJson !== undefined) {
      const spinner = ora({
        text: `Installing dependencies for ${name}`,
        spinner: 'moon',
      }).start()
      await installDeps({ functionPackageJson, functionPath, functionsDir })
      spinner.succeed(`Installed dependencies for ${name}`)
    }

    await installAddons(command, addons, path.resolve(functionPath))
    await handleOnComplete({ command, onComplete })
  }
}

const TEMPLATE_PERMISSIONS = 0o777

const createFunctionAddon = async function ({ addonName, addons, api, siteData, siteId }) {
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

/**
 *
 * @param {object} config
 * @param {import('../base-command').BaseCommand} config.command
 * @param {(command: import('../base-command').BaseCommand) => any} config.onComplete
 */
const handleOnComplete = async ({ command, onComplete }) => {
  if (onComplete) {
    await injectEnvVariables({ env: command.netlify.cachedConfig.env, site: command.netlify.site })
    await onComplete.call(command)
  }
}
/**
 *
 * @param {object} config
 * @param {*} config.addonCreated
 * @param {*} config.addonDidInstall
 * @param {import('../base-command').BaseCommand} config.command
 * @param {string} config.fnPath
 */
const handleAddonDidInstall = async ({ addonCreated, addonDidInstall, command, fnPath }) => {
  if (!addonCreated || !addonDidInstall) {
    return
  }

  const { confirmPostInstall } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmPostInstall',
      message: `This template has an optional setup script that runs after addon install. This can be helpful for first time users to try out templates. Run the script?`,
      default: false,
    },
  ])

  if (!confirmPostInstall) {
    return
  }

  await injectEnvVariables({ env: command.netlify.cachedConfig.env, site: command.netlify.site })
  addonDidInstall(fnPath)
}

/**
 *
 * @param {import('../base-command').BaseCommand} command
 * @param {*} functionAddons
 * @param {*} fnPath
 * @returns
 */
const installAddons = async function (command, functionAddons, fnPath) {
  if (functionAddons.length === 0) {
    return
  }

  const { api, site } = command.netlify
  const siteId = site.id
  if (!siteId) {
    log('No site id found, please run inside a site directory or `netlify link`')
    return false
  }
  log(`${NETLIFYDEVLOG} checking Netlify APIs...`)

  const [siteData, siteAddons] = await Promise.all([getSiteData({ api, siteId }), getAddons({ api, siteId })])

  const arr = functionAddons.map(async ({ addonDidInstall, addonName }) => {
    log(`${NETLIFYDEVLOG} installing addon: ${chalk.yellow.inverse(addonName)}`)
    try {
      const addonCreated = await createFunctionAddon({
        api,
        addons: siteAddons,
        siteId,
        addonName,
        siteData,
      })

      await handleAddonDidInstall({ addonCreated, addonDidInstall, command, fnPath })
    } catch (error_) {
      error(`${NETLIFYDEVERR} Error installing addon: `, error_)
    }
  })
  return Promise.all(arr)
}

// we used to allow for a --dir command,
// but have retired that to force every scaffolded function to be a directory
const ensureFunctionPathIsOk = function (functionsDir, name) {
  const functionPath = path.join(functionsDir, name)
  if (fs.existsSync(functionPath)) {
    log(`${NETLIFYDEVLOG} Function ${functionPath} already exists, cancelling...`)
    process.exit(1)
  }
  return functionPath
}

/**
 * The functions:create command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const functionsCreate = async (name, options, command) => {
  const functionsDir = await ensureFunctionDirExists(command)

  /* either download from URL or scaffold from template */
  const mainFunc = options.url ? downloadFromURL : scaffoldFromTemplate
  await mainFunc(command, options, name, functionsDir)
}

/**
 * Creates the `netlify functions:create` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createFunctionsCreateCommand = (program) =>
  program
    .command('functions:create')
    .alias('function:create')
    .argument('[name]', 'name of your new function file inside your functions directory')
    .description('Create a new function locally')
    .option('-n, --name <name>', 'function name')
    .option('-u, --url <url>', 'pull template from URL')
    .option('-l, --language <lang>', 'function language')
    .addExamples([
      'netlify functions:create',
      'netlify functions:create hello-world',
      'netlify functions:create --name hello-world',
    ])
    .action(functionsCreate)

module.exports = { createFunctionsCreateCommand }
