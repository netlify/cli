import cp from 'child_process'
import fs from 'fs'
import { mkdir, readdir, readFile, unlink } from 'fs/promises'
import path, { dirname, join, relative } from 'path'
import process from 'process'
import { fileURLToPath, pathToFileURL } from 'url'

import { findUp } from 'find-up'
import fuzzy from 'fuzzy'
import inquirer from 'inquirer'
import fetch from 'node-fetch'
import { createSpinner } from 'nanospinner'

import { fileExistsAsync } from '../../lib/fs.js'
import { getAddons, getCurrentAddon, getSiteData } from '../../utils/addons/prepare.js'
import {
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  chalk,
  logAndThrowError,
  log,
} from '../../utils/command-helpers.js'
import { copyTemplateDir } from '../../utils/copy-template-dir/copy-template-dir.js'
import { getDotEnvVariables, injectEnvVariables } from '../../utils/dev.js'
import execa from '../../utils/execa.js'
import { readRepoURL, validateRepoURL } from '../../utils/read-repo-url.js'
import type BaseCommand from '../base-command.js'
import type { NetlifyOptions } from '../types.js'
import type { FunctionsCreateOptionValues } from './option_values.js'

const templatesDir = path.resolve(dirname(fileURLToPath(import.meta.url)), '../../../functions-templates')

/**
 * Ensure that there's a sub-directory in `/functions-templates` named after
 * each `value` property in this list.
 */
const languages = [
  { name: 'JavaScript', value: 'javascript' },
  { name: 'TypeScript', value: 'typescript' },
]

const MOON_SPINNER = {
  interval: 80,
  frames: ['🌑 ', '🌒 ', '🌓 ', '🌔 ', '🌕 ', '🌖 ', '🌗 ', '🌘 '],
}

type FunctionType = 'edge' | 'serverless'

type FunctionsCreateOptionValuesWithURL = FunctionsCreateOptionValues & { url: string }

interface TemplateAddon {
  addonName: string
  addonDidInstall?: (fnPath: string) => void
}

/** The default export of a template's `.netlify-function-template.mjs` file */
interface FunctionTemplateMetadata {
  name: string
  description: string
  functionType: FunctionType
  priority?: number
  addons?: TemplateAddon[]
  onComplete?: (this: BaseCommand) => unknown
}

interface FunctionTemplate extends FunctionTemplateMetadata {
  lang: string
}

interface TemplateChoice {
  name: string
  value: FunctionTemplate
  short: string
  score?: number
}

interface TemplatePackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

interface RepoContentsEntry {
  name: string
  // FIXME: GitHub returns `null` for directories
  download_url: string
}

const readTemplatePackageJson = async (packageJsonPath: string): Promise<TemplatePackageJson> =>
  JSON.parse(await readFile(packageJsonPath, 'utf8')) as TemplatePackageJson

const isValidFunctionName = (name: unknown): name is string => typeof name === 'string' && /^[\w.-]+$/i.test(name)

const validateFunctionName: (name: unknown) => asserts name is string = (name) => {
  if (!isValidFunctionName(name)) {
    throw new Error(
      `Invalid function name "${String(
        name,
      )}". Function names must only contain letters, numbers, hyphens, underscores, or dots.`,
    )
  }
}

/**
 * prompt for a name if name not supplied
 */
const getNameFromArgs = async function (
  argumentName: string | undefined,
  options: FunctionsCreateOptionValues,
  defaultName?: string,
): Promise<string> {
  if (options.name) {
    if (argumentName) {
      throw new Error('function name specified in both flag and arg format, pick one')
    }
    validateFunctionName(options.name)
    return options.name
  }

  if (argumentName) {
    validateFunctionName(argumentName)
    return argumentName
  }

  const { name } = await inquirer.prompt<{ name: string }>([
    {
      name: 'name',
      message: 'Name your function:',
      default: defaultName,
      type: 'input',
      validate: (val) => isValidFunctionName(val),
      // make sure it is not undefined and is a valid filename.
      // this has some nuance i have ignored, eg crossenv and i18n concerns
    },
  ])
  return name
}

// FIXME: template choices have no `description`, so every searched string ends with "undefined"
const filterRegistry = function (registry: (TemplateChoice & { description?: undefined })[], input: string) {
  const temp = registry.map((value) => value.name + value.description)
  const filteredTemplates = fuzzy.filter(input, temp)
  const filteredTemplateNames = new Set(
    filteredTemplates.map((filteredTemplate) => (input ? filteredTemplate.string : filteredTemplate)),
  )
  return registry
    .filter((t) => filteredTemplateNames.has(t.name + t.description))
    .map((t) => {
      // add the score
      // @ts-expect-error FIXME: `find` can return `undefined`, which would make this destructuring throw
      const { score } = filteredTemplates.find((filteredTemplate) => filteredTemplate.string === t.name + t.description)
      t.score = score
      return t
    })
}

const formatRegistryArrayForInquirer = async function (
  lang: string,
  funcType: FunctionType,
): Promise<TemplateChoice[]> {
  const folders = await readdir(path.join(templatesDir, lang), { withFileTypes: true })

  const imports = await Promise.all(
    folders
      .filter((folder) => Boolean(folder?.isDirectory()))
      .map(async ({ name }) => {
        try {
          const templatePath = path.join(templatesDir, lang, name, '.netlify-function-template.mjs')
          // @ts-expect-error TS(7036) FIXME: Dynamic import's specifier must be of type 'string... Remove this comment to see the full error message
          const template = (await import(pathToFileURL(templatePath))) as { default?: FunctionTemplateMetadata }
          return template.default
        } catch {
          // noop if import fails we don't break the whole inquirer
          return undefined
        }
      }),
  )
  const registry = imports
    .filter((template): template is FunctionTemplateMetadata => template?.functionType === funcType)
    .sort((templateA, templateB) => {
      const priorityDiff = (templateA.priority || DEFAULT_PRIORITY) - (templateB.priority || DEFAULT_PRIORITY)

      if (priorityDiff !== 0) {
        return priorityDiff
      }

      // This branch is needed because `Array.prototype.sort` was not stable
      // until Node 11, so the original sorting order from `fs.readdirSync`
      // was not respected. We can simplify this once we drop support for
      // Node 10.
      // @ts-expect-error FIXME: subtracting two objects always yields `NaN`
      return templateA - templateB
    })
    .map((t): TemplateChoice => {
      const template = t as FunctionTemplate
      template.lang = lang
      return {
        // confusing but this is the format inquirer wants
        name: `[${template.name}] ${template.description}`,
        value: template,
        short: `${lang}-${template.name}`,
      }
    })
  return registry
}

/**
 * pick template from our existing templates
 */
const pickTemplate = async function (
  { language: languageFromFlag, template: templateFromFlag }: FunctionsCreateOptionValues,
  funcType: FunctionType,
): Promise<FunctionTemplate | 'url' | 'report'> {
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
    const langs =
      funcType === 'edge'
        ? languages.filter((lang) => lang.value === 'javascript' || lang.value === 'typescript')
        : languages.filter(Boolean)

    const { language: languageFromPrompt } = await inquirer.prompt<{ language: string }>({
      choices: langs,
      message: 'Select the language of your function',
      name: 'language',
      type: 'list',
    })

    language = languageFromPrompt
  }

  let templatesForLanguage: TemplateChoice[]

  try {
    templatesForLanguage = await formatRegistryArrayForInquirer(language, funcType)
  } catch {
    return logAndThrowError(`Invalid language: ${language}`)
  }

  if (templateFromFlag) {
    const match = templatesForLanguage.find((entry) => entry.value?.name === templateFromFlag)
    if (!match) {
      return logAndThrowError(
        `Template "${templateFromFlag}" not found for language "${language}". Run \`netlify functions:create\` without --template to browse available templates.`,
      )
    }
    return match.value
  }

  const { chosenTemplate } = await inquirer.prompt<{ chosenTemplate: FunctionTemplate | 'url' | 'report' }>({
    name: 'chosenTemplate',
    message: 'Pick a template',
    type: 'autocomplete',
    source(_answersSoFar: unknown, input: string | undefined) {
      // if Edge Functions template, don't show url option
      // @ts-expect-error FIXME: separators have no `value`
      const edgeCommands = specialCommands.filter((val) => val.value !== 'url')
      const parsedSpecialCommands = funcType === 'edge' ? edgeCommands : specialCommands

      if (!input || input === '') {
        // show separators
        return [...templatesForLanguage, ...parsedSpecialCommands]
      }
      // only show filtered results sorted by score
      const answers = [...filterRegistry(templatesForLanguage, input), ...parsedSpecialCommands].sort(
        // @ts-expect-error FIXME: special commands have no `score`, so this comparator can return `NaN`
        (answerA, answerB) => answerB.score - answerA.score,
      )
      return answers
    },
  })
  return chosenTemplate
}

const DEFAULT_PRIORITY = 999

const selectTypeOfFunc = async (): Promise<FunctionType> => {
  const functionTypes = [
    { name: 'Edge function (Deno)', value: 'edge' },
    { name: 'Serverless function (Node)', value: 'serverless' },
  ]

  const { functionType } = await inquirer.prompt<{ functionType: FunctionType }>([
    {
      name: 'functionType',
      message: "Select the type of function you'd like to create",
      type: 'list',
      choices: functionTypes,
    },
  ])
  return functionType
}

const ensureEdgeFuncDirExists = function (command: BaseCommand) {
  const { config, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    return logAndThrowError(
      `${NETLIFYDEVERR} No project id found, please run inside a project directory or \`netlify link\``,
    )
  }

  const functionsDir = config.build?.edge_functions ?? join(command.workingDir, 'netlify/edge-functions')
  const relFunctionsDir = relative(command.workingDir, functionsDir)

  if (!fs.existsSync(functionsDir)) {
    log(
      `${NETLIFYDEVLOG} Edge Functions directory ${chalk.magenta.inverse(
        relFunctionsDir,
      )} does not exist yet, creating it...`,
    )

    fs.mkdirSync(functionsDir, { recursive: true })

    log(`${NETLIFYDEVLOG} Edge Functions directory ${chalk.magenta.inverse(relFunctionsDir)} created.`)
  }

  return functionsDir
}

/**
 * Prompts the user to choose a functions directory
 */
const promptFunctionsDirectory = async (command: BaseCommand): Promise<string> => {
  const { api, relConfigFilePath, site } = command.netlify
  log(`\n${NETLIFYDEVLOG} functions directory not specified in ${relConfigFilePath} or UI settings`)

  if (!site.id) {
    return logAndThrowError(
      `${NETLIFYDEVERR} No project id found, please run inside a project directory or \`netlify link\``,
    )
  }

  const { functionsDir } = await inquirer.prompt<{ functionsDir: string }>([
    {
      type: 'input',
      name: 'functionsDir',
      message: 'Enter the path, relative to your project, where your functions should live:',
      default: 'netlify/functions',
    },
  ])

  try {
    log(`${NETLIFYDEVLOG} updating project settings with ${chalk.magenta.inverse(functionsDir)}`)

    await api.updateSite({
      siteId: site.id,
      body: {
        build_settings: {
          functions_dir: functionsDir,
        },
      },
    })

    log(`${NETLIFYDEVLOG} functions directory ${chalk.magenta.inverse(functionsDir)} updated in project settings`)
  } catch {
    return logAndThrowError('Error updating project settings')
  }
  return functionsDir
}

/**
 * Get functions directory (and make it if necessary)
 */
const ensureFunctionDirExists = async function (command: BaseCommand): Promise<string> {
  const { config } = command.netlify
  const functionsDirHolder =
    config.functionsDirectory || join(command.workingDir, await promptFunctionsDirectory(command))
  const relFunctionsDirHolder = relative(command.workingDir, functionsDirHolder)

  if (!fs.existsSync(functionsDirHolder)) {
    log(
      `${NETLIFYDEVLOG} functions directory ${chalk.magenta.inverse(
        relFunctionsDirHolder,
      )} does not exist yet, creating it...`,
    )

    await mkdir(functionsDirHolder, { recursive: true })

    log(`${NETLIFYDEVLOG} functions directory ${chalk.magenta.inverse(relFunctionsDirHolder)} created`)
  }

  return functionsDirHolder
}

/**
 * Download files from a given GitHub URL
 */
const downloadFromURL = async function (
  command: BaseCommand,
  options: FunctionsCreateOptionValuesWithURL,
  argumentName: string | undefined,
  functionsDir: string,
) {
  const [functionName] = options.url.split('/').slice(-1)
  const nameToUse = await getNameFromArgs(argumentName, options, functionName)
  const fnFolder = getSafeFunctionPath(functionsDir, nameToUse)

  const folderContents = (await readRepoURL(options.url)) as RepoContentsEntry[]

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
        const fileName = path.basename(name)
        const finalName = path.basename(fileName, '.js') === functionName ? `${nameToUse}.js` : fileName
        const dest = fs.createWriteStream(path.join(fnFolder, finalName))
        res.body?.pipe(dest)
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
  const fnTemplateFile = path.join(fnFolder, '.netlify-function-template.mjs')
  if (await fileExistsAsync(fnTemplateFile)) {
    const {
      default: { addons = [], onComplete },
    } = (await import(pathToFileURL(fnTemplateFile).href)) as { default: FunctionTemplateMetadata }

    await installAddons(command, addons, path.resolve(fnFolder))
    await handleOnComplete({ command, onComplete })
    // delete
    await unlink(fnTemplateFile)
  }
}

/**
 * Takes a list of existing packages and a list of packages required by a
 * function, and returns the packages from the latter that aren't present
 * in the former. The packages are returned as an array of strings with the
 * name and version range (e.g. '@netlify/functions@0.1.0').
 */
const getNpmInstallPackages = (
  existingPackages: Record<string, string> = {},
  neededPackages: Record<string, string> = {},
) =>
  Object.entries(neededPackages)
    .filter(([name]) => existingPackages[name] === undefined)
    .map(([name, version]) => `${name}@${version}`)

/**
 * When installing a function's dependencies, we first try to find a project-level
 * `package.json` file. If we find one, we identify the function's dependencies
 * that aren't already listed as dependencies of the project and install them. If
 * we don't do this check, we may be upgrading the version of a module used in
 * another part of the project, which we don't want to do.
 */
const installDeps = async ({
  functionPackageJson,
  functionPath,
  functionsDir,
}: {
  functionPackageJson: string
  functionPath: string
  functionsDir: string
}) => {
  const { dependencies: functionDependencies, devDependencies: functionDevDependencies } =
    await readTemplatePackageJson(functionPackageJson)
  const sitePackageJson = await findUp('package.json', { cwd: functionsDir })
  const npmInstallFlags = ['--no-audit', '--no-fund']

  // If there is no project-level `package.json`, we fall back to the old behavior
  // of keeping that file in the function directory and running `npm install`
  // from there.
  if (!sitePackageJson) {
    await execa('npm', ['i', ...npmInstallFlags], { cwd: functionPath })

    return
  }

  const { dependencies: siteDependencies, devDependencies: siteDevDependencies } =
    await readTemplatePackageJson(sitePackageJson)
  const dependencies = getNpmInstallPackages(siteDependencies, functionDependencies)
  const devDependencies = getNpmInstallPackages(siteDevDependencies, functionDevDependencies)
  const npmInstallPath = path.dirname(sitePackageJson)

  if (dependencies.length !== 0) {
    await execa('npm', ['i', ...dependencies, '--save', ...npmInstallFlags], { cwd: npmInstallPath })
  }

  if (devDependencies.length !== 0) {
    await execa('npm', ['i', ...devDependencies, '--save-dev', ...npmInstallFlags], { cwd: npmInstallPath })
  }

  // We installed the function's dependencies in the project-level `package.json`,
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
 */
const scaffoldFromTemplate = async function (
  command: BaseCommand,
  options: FunctionsCreateOptionValues,
  argumentName: string | undefined,
  functionsDir: string,
  funcType: FunctionType,
) {
  // pull the rest of the metadata from the template
  const chosenTemplate = await pickTemplate(options, funcType)
  if (chosenTemplate === 'url') {
    const { chosenUrl } = await inquirer.prompt<{ chosenUrl: string }>([
      {
        name: 'chosenUrl',
        message: 'URL to clone: ',
        type: 'input',
        validate: (val: string) => Boolean(validateRepoURL(val)),
        // make sure it is not undefined and is a valid filename.
        // this has some nuance i have ignored, eg crossenv and i18n concerns
      },
    ])
    options.url = chosenUrl.trim()
    try {
      await downloadFromURL(command, options as FunctionsCreateOptionValuesWithURL, argumentName, functionsDir)
    } catch {
      return logAndThrowError(`$${NETLIFYDEVERR} Error downloading from URL: ${options.url}`)
    }
  } else if (chosenTemplate === 'report') {
    log(`${NETLIFYDEVLOG} Open in browser: https://github.com/netlify/cli/issues/new`)
  } else {
    const { addons = [], lang, name: templateName, onComplete } = chosenTemplate
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
    let functionPackageJson: string | undefined

    // These files will not be part of the log message because they'll likely
    // be removed before the command finishes.
    const omittedFromOutput = new Set(['.netlify-function-template.mjs', 'package.json', 'package-lock.json'])
    const createdFiles = await copyTemplateDir(pathToTemplate, functionPath, vars)
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
    await unlink(path.join(functionPath, '.netlify-function-template.mjs'))

    // npm install
    if (functionPackageJson !== undefined) {
      const spinner = createSpinner(`Installing dependencies for ${name}`, MOON_SPINNER).start()
      await installDeps({ functionPackageJson, functionPath, functionsDir })
      spinner.success(`Installed dependencies for ${name}`)
    }

    if (funcType === 'edge') {
      await registerEFInToml(name, command.netlify)
    }

    await installAddons(command, addons, path.resolve(functionPath))
    await handleOnComplete({ command, onComplete })

    log()
    log(chalk.greenBright(`Function created!`))
  }
}

const TEMPLATE_PERMISSIONS = 0o777

const createFunctionAddon = async function ({
  addonName,
  addons,
  api,
  siteData,
  siteId,
}: {
  addonName: string
  addons: Awaited<ReturnType<typeof getAddons>>
  api: BaseCommand['netlify']['api']
  siteData: Awaited<ReturnType<typeof getSiteData>>
  siteId: string
}): Promise<boolean> {
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
    return logAndThrowError((error_ as Error).message)
  }
}

const handleOnComplete = async ({
  command,
  onComplete,
}: {
  command: BaseCommand
  onComplete: FunctionTemplateMetadata['onComplete']
}) => {
  const { config } = command.netlify

  if (onComplete) {
    const env = await getDotEnvVariables({
      devConfig: { ...config.dev },
      env: command.netlify.cachedConfig.env,
      site: command.netlify.site,
    })
    injectEnvVariables(env)
    await onComplete.call(command)
  }
}

const handleAddonDidInstall = async ({
  addonCreated,
  addonDidInstall,
  command,
  fnPath,
}: {
  addonCreated: boolean
  addonDidInstall: TemplateAddon['addonDidInstall']
  command: BaseCommand
  fnPath: string
}) => {
  const { config } = command.netlify

  if (!addonCreated || !addonDidInstall) {
    return
  }

  const { confirmPostInstall } = await inquirer.prompt<{ confirmPostInstall: boolean }>([
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

  // FIXME: these are `getDotEnvVariables` options, not the resolved environment variables
  await injectEnvVariables({
    devConfig: { ...config.dev },
    env: command.netlify.cachedConfig.env,
    site: command.netlify.site,
  } as unknown as Parameters<typeof injectEnvVariables>[0])
  addonDidInstall(fnPath)
}

const installAddons = async function (command: BaseCommand, functionAddons: TemplateAddon[], fnPath: string) {
  if (functionAddons.length === 0) {
    return
  }

  const { api, site } = command.netlify
  const siteId = site.id
  if (!siteId) {
    log('No project id found, please run inside a project directory or `netlify link`')
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
      return logAndThrowError(`${NETLIFYDEVERR} Error installing addon: ${error_}`)
    }
  })
  return Promise.all(arr)
}

const registerEFInToml = async (funcName: string, options: NetlifyOptions) => {
  const { configFilePath, relConfigFilePath } = options
  if (!fs.existsSync(configFilePath)) {
    log(`${NETLIFYDEVLOG} \`${relConfigFilePath}\` file does not exist yet. Creating it...`)
  }

  let { funcPath } = await inquirer.prompt<{ funcPath: string }>([
    {
      type: 'input',
      name: 'funcPath',
      message: `What route do you want your edge function to be invoked on?`,
      default: '/test',
      validate: (val: string) => Boolean(val),
      // Make sure route isn't undefined and is valid
      // Todo: add more validation?
    },
  ])

  // Make sure path begins with a '/'
  // eslint-disable-next-line @typescript-eslint/prefer-string-starts-ends-with -- FIXME: `startsWith` differs for non-string values
  if (funcPath[0] !== '/') {
    funcPath = `/${funcPath}`
  }

  const functionRegister = `\n\n[[edge_functions]]\nfunction = "${funcName}"\npath = "${funcPath}"`

  try {
    fs.promises.appendFile(configFilePath, functionRegister)
    log(
      `${NETLIFYDEVLOG} Function '${funcName}' registered for route \`${funcPath}\`. To change, edit your \`${relConfigFilePath}\` file.`,
    )
  } catch {
    return logAndThrowError(
      `${NETLIFYDEVERR} Unable to register function. Please check your \`${relConfigFilePath}\` file.`,
    )
  }
}

const getSafeFunctionPath = (functionsDir: string, name: string): string => {
  const resolvedFunctionsDir = path.resolve(functionsDir)
  const functionPath = path.resolve(resolvedFunctionsDir, name)
  const relativePath = path.relative(resolvedFunctionsDir, functionPath)
  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return logAndThrowError(`Invalid function name "${name}": it resolves outside the functions directory.`)
  }
  return functionPath
}

/**
 * we used to allow for a --dir command,
 * but have retired that to force every scaffolded function to be a directory
 */
const ensureFunctionPathIsOk = function (functionsDir: string, name: string): string {
  const functionPath = getSafeFunctionPath(functionsDir, name)
  if (fs.existsSync(functionPath)) {
    log(`${NETLIFYDEVLOG} Function ${functionPath} already exists, cancelling...`)
    process.exit(1)
  }
  return functionPath
}

// Scans `functions-templates/<lang>` for a template whose `.mjs` metadata
// `name` matches. Returns its `functionType` and the language folder it lives
// in, or null if nothing matches. Used to skip the funcType/language prompts
// when the user passes `--template`.
const resolveTemplateMetadata = async (
  templateName: string,
  languageHint?: string,
): Promise<{ functionType: FunctionType; language: string } | null> => {
  const langs = languageHint
    ? [languageHint]
    : (languages.map((lang) => lang.value as string | undefined).filter(Boolean) as string[])
  for (const lang of langs) {
    let folders
    try {
      folders = await readdir(path.join(templatesDir, lang), { withFileTypes: true })
    } catch {
      continue
    }
    for (const folder of folders) {
      if (!folder.isDirectory()) continue
      try {
        const templatePath = path.join(templatesDir, lang, folder.name, '.netlify-function-template.mjs')
        const mod = (await import(pathToFileURL(templatePath).href)) as {
          default?: { name?: string; functionType?: FunctionType }
        }
        const template = mod.default
        if (template?.name === templateName && template.functionType) {
          return { functionType: template.functionType, language: lang }
        }
      } catch {
        // ignore templates we can't load
      }
    }
  }
  return null
}

export const functionsCreate = async (
  name: string | undefined,
  options: FunctionsCreateOptionValues,
  command: BaseCommand,
) => {
  let functionType: FunctionType

  if (typeof options.template === 'string') {
    const resolved = await resolveTemplateMetadata(options.template, options.language)
    if (!resolved) {
      return logAndThrowError(
        `Template "${options.template}" not found${options.language ? ` for language "${options.language}"` : ''}.`,
      )
    }
    functionType = resolved.functionType
    if (!options.language) {
      options.language = resolved.language
    }
  } else {
    functionType = await selectTypeOfFunc()
  }

  const functionsDir =
    functionType === 'edge' ? await ensureEdgeFuncDirExists(command) : await ensureFunctionDirExists(command)

  /* either download from URL or scaffold from template */
  if (options.url) {
    await downloadFromURL(command, options as FunctionsCreateOptionValuesWithURL, name, functionsDir)
  } else {
    await scaffoldFromTemplate(command, options, name, functionsDir, functionType)
  }
}
