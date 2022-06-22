const { join } = require('path')

const execa = require('execa')
const inquirer = require('inquirer')

const { NETLIFYDEVLOG, NETLIFYDEVWARN, chalk, error, log } = require('../../utils/command-helpers')

const { applySettings, getSettings, writeSettings } = require('./settings')

const description = 'Create VS Code settings for an optimal experience with Netlify projects'

const getPrompt = ({ fileExists, path }) => {
  const formattedPath = chalk.underline(path)
  const message = fileExists
    ? `There is a VS Code settings file at ${formattedPath}. Can we update it?`
    : `A new VS Code settings file will be created at ${formattedPath}`

  return inquirer.prompt({
    type: 'confirm',
    name: 'confirm',
    message,
    default: true,
  })
}

const getEdgeFunctionsPath = ({ config, repositoryRoot }) =>
  config.build.edge_functions || join(repositoryRoot, 'netlify', 'edge-functions')

const getSettingsPath = (repositoryRoot) => join(repositoryRoot, '.vscode', 'settings.json')

const hasDenoVSCodeExt = async () => {
  const { stdout: extensions } = await execa('code', ['--list-extensions'], { stderr: 'inherit' })
  return extensions.split('\n').includes('denoland.vscode-deno')
}

const getDenoVSCodeExt = async () => {
  await execa('code', ['--install-extension', 'denoland.vscode-deno'], { stdio: 'inherit' })
}

const getDenoExtPrompt = () => {
  const message = 'The Deno VS Code extension is recommended. Would you like to install it now?'

  return inquirer.prompt({
    type: 'confirm',
    name: 'confirm',
    message,
    default: true,
  })
}

const run = async ({ config, repositoryRoot }) => {
  const { DenoBridge } = await import('@netlify/edge-bundler')
  const deno = new DenoBridge({
    onBeforeDownload: () =>
      log(`${NETLIFYDEVWARN} Setting up the Edge Functions environment. This may take a couple of minutes.`),
  })
  const denoBinary = await deno.getBinaryPath()
  const settingsPath = getSettingsPath(repositoryRoot)
  const edgeFunctionsPath = getEdgeFunctionsPath({ config, repositoryRoot })
  const { fileExists, settings: existingSettings } = await getSettings(settingsPath)
  const settings = applySettings(existingSettings, { denoBinary, edgeFunctionsPath, repositoryRoot })
  const { confirm } = await getPrompt({ fileExists, path: settingsPath })

  if (!confirm) {
    return
  }

  try {
    if (!(await hasDenoVSCodeExt())) {
      const { confirm: denoExtConfirm } = await getDenoExtPrompt()
      if (denoExtConfirm) getDenoVSCodeExt()
    }
  } catch {
    log(
      `${NETLIFYDEVWARN} Unable to install Deno VS Code extension. To install it manually, visit ${chalk.blue(
        'https://ntl.fyi/deno-vscode',
      )}.`,
    )
  }

  try {
    await writeSettings({ settings, settingsPath })

    log(`${NETLIFYDEVLOG} VS Code settings file ${fileExists ? 'updated' : 'created'}.`)
  } catch {
    error('Could not write VS Code settings file.')
  }
}

module.exports = { description, run }
