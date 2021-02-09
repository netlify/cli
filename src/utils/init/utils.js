const { EOL } = require('os')
const path = require('path')

const { listFrameworks } = require('@netlify/framework-info')
const chalk = require('chalk')
const cleanDeep = require('clean-deep')
const inquirer = require('inquirer')
const isEmpty = require('lodash/isEmpty')

const { fileExistsAsync, writeFileAsync } = require('../../lib/fs')

const normalizeDir = ({ siteRoot, dir, defaultValue }) => {
  if (dir === undefined) {
    return defaultValue
  }

  const relativeDir = path.relative(siteRoot, dir)
  return relativeDir || defaultValue
}

const getFrameworkInfo = async ({ siteRoot }) => {
  const frameworks = await listFrameworks({ projectDir: siteRoot })
  if (frameworks.length !== 0) {
    const [
      {
        name,
        build: { directory, commands },
        plugins,
      },
    ] = frameworks
    return {
      frameworkTitle: name,
      frameworkBuildCommand: commands[0],
      frameworkBuildDir: directory,
      frameworkPlugins: plugins,
    }
  }
  return {}
}

const isPluginInstalled = (configPlugins, plugin) =>
  configPlugins.some(({ package: configPlugin }) => configPlugin === plugin)

const getDefaultSettings = ({ siteRoot, config, frameworkPlugins, frameworkBuildCommand, frameworkBuildDir }) => {
  const recommendedPlugins = frameworkPlugins.filter((plugin) => !isPluginInstalled(config.plugins, plugin))
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

const getPromptInputs = ({
  defaultBuildCmd,
  defaultBuildDir,
  defaultFunctionsDir,
  recommendedPlugins,
  frameworkTitle,
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

  const prefix = `Seems like this is a ${formatTitle(frameworkTitle)} site.${EOL}  `
  if (recommendedPlugins.length === 1) {
    return [
      ...inputs,
      {
        type: 'confirm',
        name: 'installSinglePlugin',
        message: `${prefix}Recommended Build Plugin: ${formatTitle(recommendedPlugins[0])}${EOL}  Install ${
          recommendedPlugins[0]
        }?`,
        default: true,
      },
    ]
  }

  return [
    ...inputs,
    {
      type: 'checkbox',
      name: 'plugins',
      message: `${prefix}Recommended Build Plugins: ${recommendedPlugins
        .map(formatTitle)
        .join(', ')}${EOL}  Which plugins to install?`,
      choices: recommendedPlugins,
    },
  ]
}

const getPluginsToInstall = ({ plugins, installSinglePlugin, recommendedPlugins }) => {
  if (Array.isArray(plugins)) {
    return plugins
  }

  return installSinglePlugin === true ? [recommendedPlugins[0]] : []
}

const getBuildSettings = async ({ siteRoot, config }) => {
  const { frameworkTitle, frameworkBuildCommand, frameworkBuildDir, frameworkPlugins } = await getFrameworkInfo({
    siteRoot,
  })
  const { defaultBuildCmd, defaultBuildDir, defaultFunctionsDir, recommendedPlugins } = await getDefaultSettings({
    siteRoot,
    config,
    frameworkBuildCommand,
    frameworkBuildDir,
    frameworkPlugins,
  })
  const { buildCmd, buildDir, functionsDir, plugins, installSinglePlugin } = await inquirer.prompt(
    getPromptInputs({
      defaultBuildCmd,
      defaultBuildDir,
      defaultFunctionsDir,
      recommendedPlugins,
      frameworkTitle,
    }),
  )
  const pluginsToInstall = getPluginsToInstall({ plugins, installSinglePlugin, recommendedPlugins })
  return { buildCmd, buildDir, functionsDir, plugins: pluginsToInstall }
}

const getNetlifyToml = ({ command = '# no build command', publish = '.', functions = 'functions', plugins = [] }) => {
  const content = `# example netlify.toml
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
  ## https://github.com/netlify/cli/blob/master/docs/netlify-dev.md#project-detection
  #[dev]
  #  command = "yarn start" # Command to start your dev server
  #  port = 3000 # Port that the dev server will be listening on
  #  publish = "dist" # Folder with the static content for _redirect file

  ## more info on configuring this file: https://www.netlify.com/docs/netlify-toml-reference/
`
  if (plugins.length === 0) {
    return content
  }

  return `${content}${EOL}${plugins.map((plugin) => `[[plugins]]${EOL}  package = "${plugin}"`).join(EOL)}`
}

const saveNetlifyToml = async ({ siteRoot, config, buildCmd, buildDir, functionsDir, plugins, warn }) => {
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
      await writeFileAsync(
        tomlPath,
        getNetlifyToml({ command: buildCmd, publish: buildDir, functions: functionsDir, plugins }),
      )
    } catch (error) {
      warn(`Failed saving Netlify toml file: ${error.message}`)
    }
  }
}

const formatErrorMessage = ({ message, error }) => `${message} with error: ${chalk.red(error.message)}`

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

module.exports = { getBuildSettings, saveNetlifyToml, formatErrorMessage, createDeployKey, updateSite }
