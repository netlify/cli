import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { dirname, posix, relative } from 'path'

import * as JSONC from 'comment-json'

export type VSCodeSettings = Record<string, unknown>

const toUnixPath = (path: string): string => path.replace(/\\/g, '/')

export const applySettings = (
  existingSettings: VSCodeSettings,
  {
    denoBinary,
    edgeFunctionsPath,
    repositoryRoot,
  }: {
    denoBinary: { global: boolean; path: string }
    edgeFunctionsPath: string
    repositoryRoot: string
  },
): VSCodeSettings => {
  // TODO(serhalp): I'm not convinced we want to convert to Unix paths on Windows? Does this even work? Was this a
  // workaround for something, perhaps https://github.com/denoland/vscode_deno/pull/745?
  const relativeEdgeFunctionsPath = toUnixPath(posix.normalize(relative(repositoryRoot, edgeFunctionsPath)))
  const settings = JSONC.assign(existingSettings, {
    'deno.enable': true,
    'deno.enablePaths': existingSettings['deno.enablePaths'] || [],
    'deno.unstable': true,
    'deno.importMap': '.netlify/edge-functions-import-map.json',
  })

  // If the Edge Functions path isn't already in `deno.enabledPaths`, let's add
  // it.
  if (!(settings['deno.enablePaths'] as unknown[]).includes(relativeEdgeFunctionsPath)) {
    ;(settings['deno.enablePaths'] as unknown[]).push(relativeEdgeFunctionsPath)
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

export const getSettings = async (settingsPath: string): Promise<{ fileExists: boolean; settings: VSCodeSettings }> => {
  try {
    const stats = await stat(settingsPath)

    if (!stats.isFile()) {
      throw new Error(`${settingsPath} is not a valid file.`)
    }

    const file = await readFile(settingsPath, 'utf8')

    return {
      fileExists: true,
      settings: JSONC.parse(file) as VSCodeSettings,
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`Could not open VS Code settings file: ${(error as NodeJS.ErrnoException).message}`)
    }

    return {
      fileExists: false,
      settings: {},
    }
  }
}

export const writeSettings = async ({ settings, settingsPath }: { settings: VSCodeSettings; settingsPath: string }) => {
  const serializedSettings = JSONC.stringify(settings, null, 2)

  await mkdir(dirname(settingsPath), { recursive: true })
  await writeFile(settingsPath, serializedSettings)
}
