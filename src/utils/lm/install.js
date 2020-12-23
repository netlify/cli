const os = require('os')
const path = require('path')
const process = require('process')

const chalk = require('chalk')
const execa = require('execa')
const hasbin = require('hasbin')
const Listr = require('listr')
const tempDir = require('temp-dir')

const { shouldFetchLatestVersion, fetchLatestVersion } = require('../../lib/exec-fetcher')
const { fileExistsAsync, writeFileAsync, mkdtempAsync, readFileAsync, appendFileAsync } = require('../../lib/fs')
const { getPathInHome } = require('../../lib/settings')

const PACKAGE_NAME = 'netlify-credential-helper'
const EXEC_NAME = 'git-credential-netlify'

const { checkGitVersionStep, checkGitLFSVersionStep, checkLFSFiltersStep } = require('./steps')

const getSetupStep = (skipInstall) => {
  const platform = os.platform()
  switch (platform) {
    case 'linux':
      return setupUnix('Linux', skipInstall)
    case 'darwin':
      return setupUnix('Mac OS X', skipInstall)
    case 'win32':
      return setupWindows(skipInstall)
    default:
      throw new Error(`Platform not supported: ${platform}.
See manual setup instructions in https://github.com/netlify/netlify-credential-helper#install`)
  }
}

const setupGitConfig = async function () {
  return await configureGitConfig(getHelperPath())
}

const setupGitConfigStep = {
  title: `Configuring Git to use Netlify's Git Credential Helper`,
  task: setupGitConfig,
}

const installPlatform = async function (force) {
  const skipInstall = !force && (await installedWithPackageManager())
  const steps = [
    checkGitVersionStep,
    checkGitLFSVersionStep,
    checkLFSFiltersStep(async (ctx, task, installed) => {
      if (!installed) {
        await execa('git', ['lfs', 'install'])
        task.title += chalk.dim(' [installed]')
      }
    }),
    getSetupStep(skipInstall),
    setupGitConfigStep,
  ]

  const tasks = new Listr(steps)
  await tasks.run()

  return !skipInstall
}

const skipHelperInstall = function (skip) {
  if (skip) {
    return `Netlify's Git Credential Helper already installed with a package manager`
  }
}

const installedWithPackageManager = async function () {
  const installed = hasbin.sync('git-credential-netlify')
  return installed && !(await fileExistsAsync(getBinPath()))
}

const setupWindows = function (skipInstall) {
  return {
    title: `Installing Netlify's Git Credential Helper for Windows`,
    skip: () => skipHelperInstall(skipInstall),
    task: installWithPowershell,
  }
}

const installUnixHelper = async function () {
  const binPath = getBinPath()
  const shouldFetch = await shouldFetchLatestVersion({
    binPath,
    packageName: PACKAGE_NAME,
    execArgs: ['version'],
    pattern: `${PACKAGE_NAME}\\/v?([^\\s]+)`,
    execName: EXEC_NAME,
  })
  if (!shouldFetch) {
    return
  }

  await fetchLatestVersion({
    packageName: PACKAGE_NAME,
    execName: EXEC_NAME,
    destination: binPath,
    extension: 'tar.gz',
  })
}

const setupUnix = function (platformName, skipInstall) {
  return {
    title: `Installing Netlify's Git Credential Helper for ${platformName}`,
    skip: () => skipHelperInstall(skipInstall),
    task: async () => {
      await installUnixHelper()
      await setupUnixPath()
    },
  }
}

const installWithPowershell = async function () {
  const script = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
iex (iwr -UseBasicParsing -Uri https://github.com/netlify/netlify-credential-helper/raw/master/resources/install.ps1)`

  const temp = await mkdtempAsync(path.join(tempDir(), 'netlify-'))
  const scriptPath = path.join(temp, 'install.ps1')

  await writeFileAsync(scriptPath, script)

  return await execa('powershell', ['-ExecutionPolicy', 'unrestricted', '-File', scriptPath, '-windowstyle', 'hidden'])
}

const isBinInPath = function () {
  const envPath = process.env.PATH || ''
  const binPath = getBinPath()
  return envPath
    .replace(/"+/g, '')
    .split(path.delimiter)
    .some((part) => part === binPath)
}

const setupUnixPath = async function () {
  const shellInfo = shellVariables()

  if (isBinInPath()) {
    return true
  }

  const initContent = `
# The next line updates PATH for Netlify's Git Credential Helper.
if [ -f '${shellInfo.path}' ]; then source '${shellInfo.path}'; fi
`

  switch (shellInfo.shell) {
    case 'bash': {
      const bashPath = `script_link="$( command readlink "$BASH_SOURCE" )" || script_link="$BASH_SOURCE"
apparent_sdk_dir="$\{script_link%/*}"
if [ "$apparent_sdk_dir" == "$script_link" ]; then
apparent_sdk_dir=.
fi
sdk_dir="$( command cd -P "$apparent_sdk_dir" > /dev/null && command pwd -P )"
bin_path="$sdk_dir/bin"
if [[ ":$\{PATH}:" != *":$\{bin_path}:"* ]]; then
export PATH=$bin_path:$PATH
fi`
      await writeFileAsync(shellInfo.path, bashPath)
      return writeConfig('.bashrc', initContent)
    }
    case 'zsh':
      await writeFileAsync(shellInfo.path, `export PATH=$\{0:A:h}/bin:$PATH`)
      return await writeConfig('.zshrc', initContent)
    default: {
      const error = `Unable to set credential helper in PATH. We don't how to set the path for ${shellInfo.shell} shell.
Set the helper path in your environment PATH: ${getBinPath()}`
      throw new Error(error)
    }
  }
}

const writeConfig = async function (name, initContent) {
  const configPath = path.join(os.homedir(), name)
  if (!(await fileExistsAsync(configPath))) {
    return
  }

  const content = await readFileAsync(configPath, 'utf8')
  if (content.includes(initContent)) {
    return
  }

  return await appendFileAsync(configPath, initContent, () => {})
}

const configureGitConfig = async function (helperPath) {
  let currentCredentials = []

  try {
    const { stdout } = await execa('git', ['config', '--no-includes', '--get-regexp', '^credential'])
    currentCredentials = stdout.split('\\n')
  } catch (error) {
    // ignore error caused by not having any credential configured
    if (error.stdout !== '') {
      throw error
    }
  }

  let helperConfig = `
# The first line resets the list of helpers so we can check Netlify's first.
[credential]
  helper = ""

[credential]
  helper = netlify
`

  let section = 'credential'
  if (currentCredentials.length !== 0) {
    currentCredentials.forEach((line) => {
      const parts = line.split(' ')

      if (parts.length === 2) {
        const keys = parts[0].split('.')
        const localSection = keys.slice(0, -1).join('.')
        if (section !== localSection) {
          helperConfig += keys.length > 2 ? `\n[credential "${keys[1]}"]\n` : '\n[credential]\n'
          section = localSection
        }

        helperConfig += `  ${keys.pop()} = ${parts[1]}\n`
      }
    })
  }

  await writeFileAsync(path.join(helperPath, 'git-config'), helperConfig)

  // Git expects the config path to always use / even on Windows
  const gitConfigPath = path.join(helperPath, 'git-config').replace(/\\/g, '/')
  const gitConfigContent = `
# This next lines include Netlify's Git Credential Helper configuration in your Git configuration.
[include]
  path = ${gitConfigPath}
`
  return writeConfig('.gitconfig', gitConfigContent)
}

const getHelperPath = function () {
  return getPathInHome(['helper'])
}

const getBinPath = function () {
  return path.join(getHelperPath(), 'bin')
}

const shellVariables = function () {
  let shell = process.env.SHELL
  if (!shell) {
    throw new Error('Unable to detect SHELL type, make sure the variable is defined in your environment')
  }

  shell = shell.split(path.sep).pop()
  return {
    shell,
    path: `${getHelperPath()}/path.${shell}.inc`,
  }
}

module.exports = { installPlatform, isBinInPath, shellVariables }
