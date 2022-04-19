const { join } = require('path')

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
    await writeSettings({ settings, settingsPath })

    log(`${NETLIFYDEVLOG} VS Code settings file ${fileExists ? 'updated' : 'created'}.`)
    log(
      `${NETLIFYDEVWARN} If you don't have the Deno VS Code extension, install it by visiting ${chalk.blue(
        'https://ntl.fyi/deno-vscode',
      )}.`,
    )
  } catch {
    error('Could not write VS Code settings file.')
  }
}

module.exports = { description, run }
