// @ts-check
import { promises as fs } from 'fs'
import path from 'path'
import process from 'process'

import { INTERNAL_EDGE_FUNCTIONS_FOLDER } from '../lib/edge-functions/consts.mjs'
import { getPathInProject } from '../lib/settings.mjs'

import { error } from './command-helpers.mjs'
import { startFrameworkServer } from './framework-server.mjs'
import { INTERNAL_FUNCTIONS_FOLDER } from './functions/index.mjs'

const netlifyBuildPromise = import('@netlify/build')

// Copies `netlify.toml`, if one is defined, into the `.netlify` internal
// directory and returns the path to its new location.
const copyConfig = async ({ configPath, siteRoot }) => {
  const newConfigPath = path.resolve(siteRoot, getPathInProject(['netlify.toml']))

  try {
    await fs.copyFile(configPath, newConfigPath)
  } catch {
    // no-op
  }

  return newConfigPath
}

const cleanInternalDirectory = async (basePath) => {
  const ops = [INTERNAL_FUNCTIONS_FOLDER, INTERNAL_EDGE_FUNCTIONS_FOLDER, 'netlify.toml'].map((name) => {
    const fullPath = path.resolve(basePath, getPathInProject([name]))

    return fs.rm(fullPath, { force: true, recursive: true })
  })

  await Promise.all(ops)
}

const getBuildOptions = ({
  cachedConfig,
  options: { configPath, context, cwd = process.cwd(), debug, dry, offline, quiet, saveConfig },
}) => ({
  cachedConfig,
  configPath,
  siteId: cachedConfig.siteInfo.id,
  token: cachedConfig.token,
  dry,
  debug,
  context,
  mode: 'cli',
  telemetry: false,
  buffer: false,
  offline,
  cwd,
  quiet,
  saveConfig,
})

const runNetlifyBuild = async ({ cachedConfig, options, settings, site, timeline = 'build' }) => {
  const { default: buildSite, startDev } = await netlifyBuildPromise
  const sharedOptions = getBuildOptions({
    cachedConfig,
    options,
  })
  const devCommand = async (settingsOverrides = {}) => {
    const { ipVersion } = await startFrameworkServer({
      settings: {
        ...settings,
        ...settingsOverrides,
      },
    })

    settings.frameworkHost = ipVersion === 6 ? '::1' : '127.0.0.1'
  }

  if (timeline === 'build') {
    // Start by cleaning the internal directory, as it may have artifacts left
    // by previous builds.
    await cleanInternalDirectory(site.root)

    // Copy `netlify.toml` into the internal directory. This will be the new
    // location of the config file for the duration of the command.
    const tempConfigPath = await copyConfig({ configPath: cachedConfig.configPath, siteRoot: site.root })
    const buildSiteOptions = {
      ...sharedOptions,
      outputConfigPath: tempConfigPath,
      saveConfig: true,
    }

    // Run Netlify Build using the main entry point.
    const { success } = await buildSite(buildSiteOptions)

    if (!success) {
      error('Could not start local server due to a build error')

      return {}
    }

    // Start the dev server, forcing the usage of a static server as opposed to
    // the framework server.
    await devCommand({
      command: undefined,
      useStaticServer: true,
    })

    return { configPath: tempConfigPath }
  }

  const startDevOptions = {
    ...sharedOptions,

    // Set `quiet` to suppress non-essential output from Netlify Build unless
    // the `debug` flag is set.
    quiet: !options.debug,
  }

  // Run Netlify Build using the `startDev` entry point.
  const { error: startDevError, success } = await startDev(devCommand, startDevOptions)

  if (!success) {
    error(`Could not start local development server\n\n${startDevError.message}\n\n${startDevError.stack}`)
  }

  return {}
}

export const runDevTimeline = (options) => runNetlifyBuild({ ...options, timeline: 'dev' })

export const runBuildTimeline = (options) => runNetlifyBuild({ ...options, timeline: 'build' })
