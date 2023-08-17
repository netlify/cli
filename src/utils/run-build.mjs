// @ts-check
import { promises as fs } from 'fs'
import path, { join } from 'path'

import { getBootstrapURL } from '../lib/edge-functions/bootstrap.mjs'
import { INTERNAL_EDGE_FUNCTIONS_FOLDER } from '../lib/edge-functions/consts.mjs'
import { getPathInProject } from '../lib/settings.mjs'

import { error } from './command-helpers.mjs'
import { startFrameworkServer } from './framework-server.mjs'
import { INTERNAL_FUNCTIONS_FOLDER } from './functions/index.mjs'

const netlifyBuildPromise = import('@netlify/build')

/**
 * Copies `netlify.toml`, if one is defined, into the `.netlify` internal
 * directory and returns the path to its new location.
 * @param {string} configPath
 * @param {string} destinationFolder The folder where it should be copied to. Either the root of the repo or a package inside a monorepo
 */
const copyConfig = async (configPath, destinationFolder) => {
  const newConfigPath = path.resolve(destinationFolder, getPathInProject(['netlify.toml']))

  try {
    await fs.copyFile(configPath, newConfigPath)
  } catch {
    // no-op
  }

  return newConfigPath
}

/**
 * @param {string} basePath
 */
const cleanInternalDirectory = async (basePath) => {
  const ops = [INTERNAL_FUNCTIONS_FOLDER, INTERNAL_EDGE_FUNCTIONS_FOLDER, 'netlify.toml'].map((name) => {
    const fullPath = path.resolve(basePath, getPathInProject([name]))

    return fs.rm(fullPath, { force: true, recursive: true })
  })

  await Promise.all(ops)
}

/**
 * @param {object} params
 * @param {import('../commands/base-command.mjs').default} params.command
 * @param {import('../commands/base-command.mjs').default} params.command
 * @param {*} params.options The flags of the command
 * @param {import('./types.js').ServerSettings} params.settings
 * @param {NodeJS.ProcessEnv} [params.env]
 * @param {'build' | 'dev'} [params.timeline]
 * @returns
 */
export const runNetlifyBuild = async ({ command, env = {}, options, settings, timeline = 'build' }) => {
  const { cachedConfig, site } = command.netlify

  const { default: buildSite, startDev } = await netlifyBuildPromise

  const sharedOptions = {
    cachedConfig,
    configPath: cachedConfig.configPath,
    siteId: cachedConfig.siteInfo.id,
    token: cachedConfig.token,
    dry: options.dry,
    debug: options.debug,
    context: options.context,
    mode: 'cli',
    telemetry: false,
    buffer: false,
    offline: options.offline,
    packagePath: command.workspacePackage,
    cwd: cachedConfig.buildDir,
    quiet: options.quiet,
    saveConfig: options.saveConfig,
    edgeFunctionsBootstrapURL: getBootstrapURL(),
  }

  const devCommand = async (settingsOverrides = {}) => {
    let cwd = command.workingDir

    if (!options.cwd && command.project.workspace?.packages.length) {
      cwd = join(command.project.jsWorkspaceRoot, settings.baseDirectory || '')
    }

    const { ipVersion } = await startFrameworkServer({
      settings: {
        ...settings,
        ...settingsOverrides,
      },
      cwd,
    })

    settings.frameworkHost = ipVersion === 6 ? '::1' : '127.0.0.1'
  }

  if (timeline === 'build') {
    // Start by cleaning the internal directory, as it may have artifacts left
    // by previous builds.
    await cleanInternalDirectory(site.root)

    // Copy `netlify.toml` into the internal directory. This will be the new
    // location of the config file for the duration of the command.
    const tempConfigPath = await copyConfig(cachedConfig.configPath, command.workingDir)
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
    env,
  }

  // Run Netlify Build using the `startDev` entry point.
  const { error: startDevError, success } = await startDev(devCommand, startDevOptions)

  if (!success && startDevError) {
    error(`Could not start local development server\n\n${startDevError.message}\n\n${startDevError.stack}`)
  }

  return {}
}

/**
 * @param {Omit<Parameters<typeof runNetlifyBuild>[0], 'timeline'>} options
 */
export const runDevTimeline = (options) => runNetlifyBuild({ ...options, timeline: 'dev' })

/**
 * @param {Omit<Parameters<typeof runNetlifyBuild>[0], 'timeline'>} options
 */
export const runBuildTimeline = (options) => runNetlifyBuild({ ...options, timeline: 'build' })
