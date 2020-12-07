const path = require('path')

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

const getDefaultSettings = ({ siteRoot, config }) => {
  const { command: defaultBuildCmd, publish: defaultBuildDir, functions: defaultFunctionsDir } = config.build

  return {
    defaultBuildCmd,
    defaultBuildDir: normalizeDir({ siteRoot, dir: defaultBuildDir, defaultValue: '.' }),
    defaultFunctionsDir: normalizeDir({ siteRoot, dir: defaultFunctionsDir, defaultValue: 'functions' }),
  }
}

const getBuildSettings = async ({ siteRoot, config }) => {
  const { defaultBuildCmd, defaultBuildDir, defaultFunctionsDir } = getDefaultSettings({ siteRoot, config })
  const { buildCmd, buildDir, functionsDir } = await inquirer.prompt([
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
  ])

  return { buildCmd, buildDir, functionsDir }
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
  ## https://github.com/netlify/cli/blob/master/docs/netlify-dev.md#project-detection
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

const formatErrorMessage = ({ message, error }) => `${message} with error: ${chalk.red(error.message)}`

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
