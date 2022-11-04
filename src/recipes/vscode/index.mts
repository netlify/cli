// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'join'.
const { join } = require('path')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'execa'.
const execa = require('execa')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'inquirer'.
const inquirer = require('inquirer')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const { NETLIFYDEVLOG, NETLIFYDEVWARN, chalk, error, log } = require('../../utils/command-helpers.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'applySetti... Remove this comment to see the full error message
const { applySettings, getSettings, writeSettings } = require('./settings.cjs')

const description = 'Create VS Code settings for an optimal experience with Netlify projects'

const getPrompt = ({
  fileExists,
  path
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
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

const getEdgeFunctionsPath = ({
  config,
  repositoryRoot
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) =>
  config.build.edge_functions || join(repositoryRoot, 'netlify', 'edge-functions')

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const getSettingsPath = (repositoryRoot: $TSFixMe) => join(repositoryRoot, '.vscode', 'settings.json')

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

const run = async ({
  config,
  repositoryRoot
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
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
