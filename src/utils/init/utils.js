const { EOL } = require('os')
const path = require('path')

const chalk = require('chalk')
const cleanDeep = require('clean-deep')
const inquirer = require('inquirer')
const isEmpty = require('lodash/isEmpty')

const { fileExistsAsync, writeFileAsync } = require('../../lib/fs')

const { getFrameworkInfo } = require('./frameworks')
const { detectNodeVersion } = require('./node-version')
const { getPluginsList, getPluginInfo, getRecommendPlugins, getPluginsToInstall, getUIPlugins } = require('./plugins')

const normalizeDir = ({ siteRoot, dir, defaultValue }) => {
  if (dir === undefined) {
    return defaultValue
  }

  const relativeDir = path.relative(siteRoot, dir)
  return relativeDir || defaultValue
}

const getDefaultSettings = ({ siteRoot, config, frameworkPlugins, frameworkBuildCommand, frameworkBuildDir }) => {
  const recommendedPlugins = getRecommendPlugins(frameworkPlugins, config)
  const {
    command: defaultBuildCmd = frameworkBuildCommand,
    publish: defaultBuildDir = frameworkBuildDir,
    functions: defaultFunctionsDir,
  } = config.build

  return {
    defaultBuildCmd,
    defaultBuildDir: normalizeDir({ siteRoot, dir: defaultBuildDir, defaultValue: '.' }),
    defaultFunctionsDir: normalizeDir({ siteRoot, dir: defaultFunctionsDir, defaultValue: 'netlify/functions' }),
    recommendedPlugins,
  }
}

const getPromptInputs = async ({
  defaultBuildCmd,
  defaultBuildDir,
  defaultFunctionsDir,
  recommendedPlugins,
  frameworkName,
}) => {
  const inputs = [
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
    {
      type: 'input',
      name: 'functionsDir',
      message: 'Netlify functions folder:',
      default: defaultFunctionsDir,
    },
  ]

  if (recommendedPlugins.length === 0) {
    return inputs
  }

  const pluginsList = await getPluginsList()

  const prefix = `Seems like this is a ${formatTitle(frameworkName)} site.${EOL}❇️  `
  if (recommendedPlugins.length === 1) {
    const { name } = getPluginInfo(pluginsList, recommendedPlugins[0])
    return [
      ...inputs,
      {
        type: 'confirm',
        name: 'installSinglePlugin',
        message: `${prefix}We're going to install this Build Plugin: ${formatTitle(
          `${name} plugin`,
        )}${EOL}➡️  OK to install?`,
        default: true,
      },
    ]
  }

  const infos = recommendedPlugins.map((packageName) => getPluginInfo(pluginsList, packageName))
  return [
    ...inputs,
    {
      type: 'checkbox',
      name: 'plugins',
      message: `${prefix}We're going to install these plugins: ${infos
        .map(({ name }) => `${name} plugin`)
        .map(formatTitle)
        .join(', ')}${EOL}➡️  OK to install??`,
      choices: infos.map(({ name, package }) => ({ name: `${name} plugin`, value: package })),
      default: infos.map(({ package }) => package),
    },
  ]
}

const getBuildSettings = async ({ siteRoot, config, env, warn }) => {
  const nodeVersion = await detectNodeVersion({ siteRoot, env, warn })
  const {
    frameworkName,
    frameworkBuildCommand,
    frameworkBuildDir,
    frameworkPlugins = [],
  } = await getFrameworkInfo({
    siteRoot,
    nodeVersion,
  })
  const { defaultBuildCmd, defaultBuildDir, defaultFunctionsDir, recommendedPlugins } = await getDefaultSettings({
    siteRoot,
    config,
    frameworkBuildCommand,
    frameworkBuildDir,
    frameworkPlugins,
  })
  const { buildCmd, buildDir, functionsDir, plugins, installSinglePlugin } = await inquirer.prompt(
    await getPromptInputs({
      defaultBuildCmd,
      defaultBuildDir,
      defaultFunctionsDir,
      recommendedPlugins,
      frameworkName,
    }),
  )
  const pluginsToInstall = getPluginsToInstall({
    plugins,
    installSinglePlugin,
    recommendedPlugins,
  })
  return { buildCmd, buildDir, functionsDir, pluginsToInstall }
}

const getNetlifyToml = ({
  command = '# no build command',
  publish = '.',
  functions = 'functions',
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

  ## more info on configuring this file: https://www.netlify.com/docs/netlify-toml-reference/
`

const saveNetlifyToml = async ({ siteRoot, config, buildCmd, buildDir, functionsDir, warn }) => {
  const tomlPath = path.join(siteRoot, 'netlify.toml')
  const exists = await fileExistsAsync(tomlPath)
  const cleanedConfig = cleanDeep(config)
  if (exists || !isEmpty(cleanedConfig)) {
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
      await writeFileAsync(tomlPath, getNetlifyToml({ command: buildCmd, publish: buildDir, functions: functionsDir }))
    } catch (error) {
      warn(`Failed saving Netlify toml file: ${error.message}`)
    }
  }
}

const formatErrorMessage = ({ message, error }) => {
  const errorMessage = error.json ? `${error.message} - ${JSON.stringify(error.json)}` : error.message
  return `${message} with error: ${chalk.red(errorMessage)}`
}

const formatTitle = (title) => chalk.cyan(title)

const createDeployKey = async ({ api, failAndExit }) => {
  try {
    const deployKey = await api.createDeployKey()
    return deployKey
  } catch (error) {
    const message = formatErrorMessage({ message: 'Failed creating deploy key', error })
    failAndExit(message)
  }
}

const updateSite = async ({ siteId, api, failAndExit, options }) => {
  try {
    const updatedSite = await api.updateSite({ siteId, body: options })
    return updatedSite
  } catch (error) {
    const message = formatErrorMessage({ message: 'Failed updating site with repo information', error })
    failAndExit(message)
  }
}

const setupSite = async ({ api, failAndExit, siteId, repo, configPlugins, pluginsToInstall }) => {
  const updatedSite = await updateSite({
    siteId,
    api,
    failAndExit,
    // merge existing plugins with new ones
    options: { repo, plugins: [...getUIPlugins(configPlugins), ...pluginsToInstall] },
  })

  return updatedSite
}

module.exports = { getBuildSettings, saveNetlifyToml, formatErrorMessage, createDeployKey, updateSite, setupSite }
