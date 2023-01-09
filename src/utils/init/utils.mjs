// @ts-check
import { writeFile } from 'fs/promises'
import path from 'path'
import process from 'process'

import cleanDeep from 'clean-deep'
import inquirer from 'inquirer'

import { fileExistsAsync } from '../../lib/fs.mjs'
import { normalizeBackslash } from '../../lib/path.mjs'
import { chalk, error as failAndExit, log, warn } from '../command-helpers.mjs'

import { getFrameworkInfo } from './frameworks.mjs'
import { detectNodeVersion } from './node-version.mjs'
import { getRecommendPlugins, getUIPlugins } from './plugins.mjs'

const normalizeDir = ({ baseDirectory, defaultValue, dir }) => {
  if (dir === undefined) {
    return defaultValue
  }

  const relativeDir = path.relative(baseDirectory, dir)
  return relativeDir || defaultValue
}

const getDefaultBase = ({ baseDirectory, repositoryRoot }) => {
  if (baseDirectory !== repositoryRoot && baseDirectory.startsWith(repositoryRoot)) {
    return path.relative(repositoryRoot, baseDirectory)
  }
}

const getDefaultSettings = ({
  baseDirectory,
  config,
  frameworkBuildCommand,
  frameworkBuildDir,
  frameworkPlugins,
  repositoryRoot,
}) => {
  const recommendedPlugins = getRecommendPlugins(frameworkPlugins, config)
  const {
    command: defaultBuildCmd = frameworkBuildCommand,
    publish: defaultBuildDir = frameworkBuildDir,
    functions: defaultFunctionsDir,
  } = config.build

  return {
    defaultBaseDir: getDefaultBase({ repositoryRoot, baseDirectory }),
    defaultBuildCmd,
    defaultBuildDir: normalizeDir({ baseDirectory, dir: defaultBuildDir, defaultValue: '.' }),
    defaultFunctionsDir: normalizeDir({ baseDirectory, dir: defaultFunctionsDir, defaultValue: 'netlify/functions' }),
    recommendedPlugins,
  }
}

const getPromptInputs = ({ defaultBaseDir, defaultBuildCmd, defaultBuildDir }) => {
  const inputs = [
    defaultBaseDir !== undefined && {
      type: 'input',
      name: 'baseDir',
      message: 'Base directory (e.g. projects/frontend):',
      default: defaultBaseDir,
    },
    {
      type: 'input',
      name: 'buildCmd',
      message: 'Your build command (hugo build/yarn run build/etc):',
      filter: (val) => (val === '' ? '# no build command' : val),
      default: defaultBuildCmd,
    },
    {
      type: 'input',
      name: 'buildDir',
      message: 'Directory to deploy (blank for current dir):',
      default: defaultBuildDir,
    },
  ].filter(Boolean)

  return inputs.filter(Boolean)
}

// `repositoryRoot === siteRoot` means the base directory wasn't detected by @netlify/config, so we use cwd()
const getBaseDirectory = ({ repositoryRoot, siteRoot }) =>
  path.normalize(repositoryRoot) === path.normalize(siteRoot) ? process.cwd() : siteRoot

export const getBuildSettings = async ({ config, env, repositoryRoot, siteRoot }) => {
  const baseDirectory = getBaseDirectory({ repositoryRoot, siteRoot })
  const nodeVersion = await detectNodeVersion({ baseDirectory, env })
  const {
    frameworkName,
    frameworkBuildCommand,
    frameworkBuildDir,
    frameworkPlugins = [],
  } = await getFrameworkInfo({
    baseDirectory,
    nodeVersion,
  })
  const { defaultBaseDir, defaultBuildCmd, defaultBuildDir, defaultFunctionsDir, recommendedPlugins } =
    await getDefaultSettings({
      repositoryRoot,
      config,
      baseDirectory,
      frameworkBuildCommand,
      frameworkBuildDir,
      frameworkPlugins,
    })

  if (recommendedPlugins.length !== 0) {
    log(`Configuring ${formatTitle(frameworkName)} runtime...`)
    log()
  }

  const { baseDir, buildCmd, buildDir } = await inquirer.prompt(
    getPromptInputs({
      defaultBaseDir,
      defaultBuildCmd,
      defaultBuildDir,
    }),
  )

  const pluginsToInstall = recommendedPlugins.map((plugin) => ({ package: plugin }))
  const normalizedBaseDir = baseDir ? normalizeBackslash(baseDir) : undefined

  return { baseDir: normalizedBaseDir, buildCmd, buildDir, functionsDir: defaultFunctionsDir, pluginsToInstall }
}

const getNetlifyToml = ({
  command = '# no build command',
  functions = 'functions',
  publish = '.',
}) => `# example netlify.toml
[build]
  command = "${command}"
  functions = "${functions}"
  publish = "${publish}"

  ## Uncomment to use this redirect for Single Page Applications like create-react-app.
  ## Not needed for static site generators.
  #[[redirects]]
  #  from = "/*"
  #  to = "/index.html"
  #  status = 200

  ## (optional) Settings for Netlify Dev
  ## https://github.com/netlify/cli/blob/main/docs/netlify-dev.md#project-detection
  #[dev]
  #  command = "yarn start" # Command to start your dev server
  #  port = 3000 # Port that the dev server will be listening on
  #  publish = "dist" # Folder with the static content for _redirect file

  ## more info on configuring this file: https://docs.netlify.com/configure-builds/file-based-configuration/
`

export const saveNetlifyToml = async ({
  baseDir,
  buildCmd,
  buildDir,
  config,
  configPath,
  functionsDir,
  repositoryRoot,
}) => {
  const tomlPathParts = [repositoryRoot, baseDir, 'netlify.toml'].filter(Boolean)
  const tomlPath = path.join(...tomlPathParts)
  if (await fileExistsAsync(tomlPath)) {
    return
  }

  // We don't want to create a `netlify.toml` file that overrides existing configuration
  // In a monorepo the configuration can come from a repo level netlify.toml
  // so we make sure it doesn't by checking `configPath === undefined`
  if (configPath === undefined && Object.keys(cleanDeep(config)).length !== 0) {
    return
  }

  const { makeNetlifyTOML } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'makeNetlifyTOML',
      message: 'No netlify.toml detected. Would you like to create one with these build settings?',
      default: true,
    },
  ])
  if (makeNetlifyTOML) {
    try {
      await writeFile(
        tomlPath,
        getNetlifyToml({ command: buildCmd, publish: buildDir, functions: functionsDir }),
        'utf-8',
      )
    } catch (error) {
      warn(`Failed saving Netlify toml file: ${error.message}`)
    }
  }
}

export const formatErrorMessage = ({ error, message }) => {
  const errorMessage = error.json ? `${error.message} - ${JSON.stringify(error.json)}` : error.message
  return `${message} with error: ${chalk.red(errorMessage)}`
}

const formatTitle = (title) => chalk.cyan(title)

export const createDeployKey = async ({ api }) => {
  try {
    const deployKey = await api.createDeployKey()
    return deployKey
  } catch (error) {
    const message = formatErrorMessage({ message: 'Failed creating deploy key', error })
    failAndExit(message)
  }
}

export const updateSite = async ({ api, options, siteId }) => {
  try {
    const updatedSite = await api.updateSite({ siteId, body: options })
    return updatedSite
  } catch (error) {
    const message = formatErrorMessage({ message: 'Failed updating site with repo information', error })
    failAndExit(message)
  }
}

export const setupSite = async ({ api, configPlugins, pluginsToInstall, repo, siteId }) => {
  const updatedSite = await updateSite({
    siteId,
    api,
    // merge existing plugins with new ones
    options: { repo, plugins: [...getUIPlugins(configPlugins), ...pluginsToInstall] },
  })

  return updatedSite
}
