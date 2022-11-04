// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fs'.
const { promises: fs } = require('fs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'dirname'.
const { dirname, relative } = require('path')

const unixify = require('unixify')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'applySetti... Remove this comment to see the full error message
const applySettings = (existingSettings: $TSFixMe, {
  denoBinary,
  edgeFunctionsPath,
  repositoryRoot
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const relativeEdgeFunctionsPath = unixify(relative(repositoryRoot, edgeFunctionsPath))
  const settings = {
    ...existingSettings,
    'deno.enable': true,
    'deno.enablePaths': existingSettings['deno.enablePaths'] || [],
    'deno.unstable': true,
    'deno.importMap': '.netlify/edge-functions-import-map.json',
  }

  // If the Edge Functions path isn't already in `deno.enabledPaths`, let's add
  // it.
  if (!settings['deno.enablePaths'].includes(relativeEdgeFunctionsPath)) {
    settings['deno.enablePaths'].push(relativeEdgeFunctionsPath)
  }

  // If the Deno CLI binary isn't globally installed, we need to set the path
  // to it in the settings file or the extension won't know where to find it.
  // The only exception is when `deno.path` has already been defined, because
  // we don't want to override that.
  if (!denoBinary.global && settings['deno.path'] === undefined) {
    settings['deno.path'] = denoBinary.path
  }

  return settings
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getSetting... Remove this comment to see the full error message
const getSettings = async (settingsPath: $TSFixMe) => {
  try {
    const stats = await fs.stat(settingsPath)

    if (!stats.isFile()) {
      throw new Error(`${settingsPath} is not a valid file.`)
    }

    const file = await fs.readFile(settingsPath)

    return {
      fileExists: true,
      settings: JSON.parse(file),
    }
  } catch (error) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if ((error as $TSFixMe).code !== 'ENOENT') {
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      throw new Error(`Could not open VS Code settings file: ${(error as $TSFixMe).message}`);
    }

    return {
      fileExists: false,
      settings: {},
    }
  }
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'writeSetti... Remove this comment to see the full error message
const writeSettings = async ({
  settings,
  settingsPath
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const serializedSettings = JSON.stringify(settings, null, 2)

  await fs.mkdir(dirname(settingsPath), { recursive: true })
  await fs.writeFile(settingsPath, serializedSettings)
}

module.exports = { applySettings, getSettings, writeSettings }
