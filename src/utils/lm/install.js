const fs = require('fs')
const os = require('os')
const path = require('path')
const process = require('process')

const chalk = require('chalk')
const execa = require('execa')
const hasbin = require('hasbin')
const Listr = require('listr')
const fetch = require('node-fetch')

const { checkGitVersionStep, checkGitLFSVersionStep, checkLFSFiltersStep } = require('./steps')

const installPlatform = async function (force) {
  const platform = os.platform()
  const skipInstall = !force && installedWithPackageManager()

  const steps = [
    checkGitVersionStep,
    checkGitLFSVersionStep,
    checkLFSFiltersStep(async (ctx, task, installed) => {
      if (!installed) {
        await execa('git', ['lfs', 'install'])
        task.title += chalk.dim(' [installed]')
      }
    }),
  ]

  switch (platform) {
    case 'linux':
      steps.push(setupUnix('linux', 'Linux', skipInstall))
      break
    case 'darwin':
      steps.push(setupUnix('darwin', 'Mac OS X', skipInstall))
      break
    case 'win32':
      steps.push(setupWindows(skipInstall))
      break
    default:
      throw new Error(`Platform not supported: ${platform}.
See manual setup instructions in https://github.com/netlify/netlify-credential-helper#install`)
  }

  steps.push({
    title: `Configuring Git to use Netlify's Git Credential Helper`,
    task: setupGitConfig,
  })

  const tasks = new Listr(steps)
  await tasks.run()

  return !skipInstall
}

const skipHelperInstall = function (skip) {
  if (skip) {
    return `Netlify's Git Credential Helper already installed with a package manager`
  }
}

const installedWithPackageManager = function () {
  const installed = hasbin.sync('git-credential-netlify')
  return installed && !fs.existsSync(joinBinPath())
}

const setupWindows = function (skipInstall) {
  return {
    title: `Installing Netlify's Git Credential Helper for Windows`,
    skip: () => skipHelperInstall(skipInstall),
    task: installWithPowershell,
  }
}

const setupUnix = function (platformKey, platformName, skipInstall) {
  const task = async function () {
    const release = await resolveRelease()
    const file = await downloadFile(platformKey, release, 'tar.gz')
    const helperPath = joinHelperPath()

    await extractFile(file, helperPath)
    setupUnixPath()
  }
  return {
    title: `Installing Netlify's Git Credential Helper for ${platformName}`,
    skip: () => skipHelperInstall(skipInstall),
    task,
  }
}

const installWithPowershell = async function () {
  const script = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
iex (iwr -UseBasicParsing -Uri https://github.com/netlify/netlify-credential-helper/raw/master/resources/install.ps1)`

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'netlify-'))
  const scriptPath = path.join(temp, 'install.ps1')

  fs.writeFileSync(scriptPath, script)

  return await execa('powershell', ['-ExecutionPolicy', 'unrestricted', '-File', scriptPath, '-windowstyle', 'hidden'])
}

const setupGitConfig = async function () {
  return await configureGitConfig(joinHelperPath())
}

const resolveRelease = async function () {
  const res = await fetch('https://api.github.com/repos/netlify/netlify-credential-helper/releases/latest')
  const json = await res.json()
  return json.tag_name
}

const downloadFile = async function (platform, release, format) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'netlify-'))
  const name = `git-credential-netlify-${platform}-amd64.${format}`
  const filePath = path.join(temp, name)

  const url = `https://github.com/netlify/netlify-credential-helper/releases/download/${release}/${name}`
  const res = await fetch(url)
  const dest = fs.createWriteStream(filePath)

  await new Promise((resolve, reject) => {
    res.body.pipe(dest)
    res.body.on('error', reject)
    dest.on('finish', resolve)
  })

  return filePath
}

const extractFile = async function (file, helperPath) {
  const binPath = path.join(helperPath, 'bin')

  if (!fs.existsSync(binPath)) {
    try {
      fs.mkdirSync(binPath, { recursive: true })
    } catch (error) {
      if (!error.code || error.code !== 'ENOENT') {
        throw error
      }

      // Try creating the directory structure without
      // the recursive option because some versions
      // of Node ignore this option even when set.
      // See: https://github.com/FredLackey/node/pull/1
      const basePath = path.dirname(helperPath)
      if (!fs.existsSync(basePath)) {
        fs.mkdirSync(basePath)
      }

      if (!fs.existsSync(helperPath)) {
        fs.mkdirSync(helperPath)
      }

      if (!fs.existsSync(binPath)) {
        fs.mkdirSync(binPath)
      }
    }
  }

  await execa('tar', ['-C', binPath, '-xzf', file])
}

const setupUnixPath = function () {
  const shellInfo = shellVariables()

  if (process.env.PATH && process.env.PATH.includes(joinBinPath())) {
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
      fs.writeFileSync(shellInfo.path, bashPath)
      return writeConfig('.bashrc', initContent)
    }
    case 'zsh':
      fs.writeFileSync(shellInfo.path, `export PATH=$\{0:A:h}/bin:$PATH`)
      return writeConfig('.zshrc', initContent)
    default: {
      const error = `Unable to set credential helper in PATH. We don't how to set the path for ${shellInfo.shell} shell.
Set the helper path in your environment PATH: ${joinBinPath()}`
      throw new Error(error)
    }
  }
}

const writeConfig = function (name, initContent) {
  const configPath = path.join(os.homedir(), name)
  if (!fs.existsSync(configPath)) {
    return
  }

  const content = fs.readFileSync(configPath, 'utf8')
  if (content.includes(initContent)) {
    return
  }

  return fs.appendFile(configPath, initContent, () => {})
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

  fs.writeFileSync(path.join(helperPath, 'git-config'), helperConfig)

  // Git expects the config path to always use / even on Windows
  const gitConfigPath = path.join(helperPath, 'git-config').replace(/\\/g, '/')
  const gitConfigContent = `
# This next lines include Netlify's Git Credential Helper configuration in your Git configuration.
[include]
  path = ${gitConfigPath}
`
  return writeConfig('.gitconfig', gitConfigContent)
}

const joinHelperPath = function () {
  return path.join(os.homedir(), '.netlify', 'helper')
}

const joinBinPath = function () {
  return path.join(joinHelperPath(), 'bin')
}

const shellVariables = function () {
  let shell = process.env.SHELL
  if (!shell) {
    throw new Error('Unable to detect SHELL type, make sure the variable is defined in your environment')
  }

  shell = shell.split(path.sep).pop()
  return {
    shell,
    path: `${joinHelperPath()}/path.${shell}.inc`,
  }
}

module.exports = { installPlatform, joinBinPath, shellVariables }
