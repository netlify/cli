import { promises as fs } from 'fs'
import path, { join } from 'path'

import { NetlifyConfig, type GeneratedFunction } from '@netlify/build'

import BaseCommand from '../commands/base-command.js'
import { getBootstrapURL } from '../lib/edge-functions/bootstrap.js'
import { INTERNAL_EDGE_FUNCTIONS_FOLDER } from '../lib/edge-functions/consts.js'
import { getPathInProject } from '../lib/settings.js'

import { logAndThrowError } from './command-helpers.js'
import { getFeatureFlagsFromSiteInfo } from './feature-flags.js'
import { startFrameworkServer } from './framework-server.js'
import { INTERNAL_FUNCTIONS_FOLDER } from './functions/index.js'
import { ServerSettings } from './types.js'

const netlifyBuildPromise = import('@netlify/build')

/**
 * Copies `netlify.toml`, if one is defined, into the `.netlify` internal
 * directory and returns the path to its new location.
 */
const copyConfig = async (configPath: string, destinationFolder: string): Promise<string> => {
  const newConfigPath = path.resolve(destinationFolder, getPathInProject(['netlify.toml']))

  try {
    await fs.copyFile(configPath, newConfigPath)
  } catch {
    // no-op
  }

  return newConfigPath
}

const cleanInternalDirectory = async (basePath?: string) => {
  if (!basePath) {
    return
  }

  const ops = [INTERNAL_FUNCTIONS_FOLDER, INTERNAL_EDGE_FUNCTIONS_FOLDER, 'netlify.toml'].map((name) => {
    const fullPath = path.resolve(basePath, getPathInProject([name]))

    return fs.rm(fullPath, { force: true, recursive: true })
  })

  await Promise.all(ops)
}

type BuildOptions = {
  context: string
  cwd?: string
  debug: boolean
  dir?: string
  dry: boolean
  offline: boolean
  quiet: boolean
  saveConfig: boolean
  skipWaitPort?: boolean
}

type RunNetlifyBuildOptions = {
  command: BaseCommand
  // The flags of the command
  options: BuildOptions
  settings: ServerSettings
  env: NodeJS.ProcessEnv
  timeline: 'dev' | 'build'
}

export async function runNetlifyBuild(
  opts: RunNetlifyBuildOptions & { timeline: 'dev' },
): Promise<{ configMutations: unknown; generatedFunctions: GeneratedFunction[] }>
export async function runNetlifyBuild(
  opts: RunNetlifyBuildOptions & { timeline: 'build' },
): Promise<{ configPath: string; generatedFunctions: GeneratedFunction[] }>
export async function runNetlifyBuild({
  command,
  env = {},
  options,
  settings,
  timeline = 'build',
}: {
  command: BaseCommand
  // The flags of the command
  options: BuildOptions
  settings: ServerSettings
  env: NodeJS.ProcessEnv
  timeline: 'build' | 'dev'
}) {
  const { apiOpts, cachedConfig, site } = command.netlify

  const { default: buildSite, startDev } = await netlifyBuildPromise

  const sharedOptions = {
    cachedConfig,
    configPath: cachedConfig.configPath,
    saveConfig: options.saveConfig,
    siteId: cachedConfig.siteInfo.id,
    token: cachedConfig.token,
    apiHost: apiOpts.host,
    dry: options.dry,
    debug: options.debug,
    context: options.context,
    mode: 'cli',
    telemetry: false,
    buffer: false,
    featureFlags: getFeatureFlagsFromSiteInfo(cachedConfig.siteInfo),
    offline: options.offline,
    packagePath: command.workspacePackage,
    cwd: cachedConfig.buildDir,
    quiet: options.quiet,
    saveConfig: options.saveConfig,
    edgeFunctionsBootstrapURL: await getBootstrapURL(),
  }

  const devCommand = async ({
    netlifyConfig,
    settingsOverrides,
  }: { netlifyConfig?: NetlifyConfig; settingsOverrides?: Partial<ServerSettings> } = {}) => {
    let cwd = command.workingDir

    if (!options.cwd && command.project.workspace?.packages.length && command.project.workspace.isRoot) {
      cwd = join(command.project.jsWorkspaceRoot, settings.baseDirectory || '')
    }

    const { ipVersion } = await startFrameworkServer({
      settings: {
        ...settings,
        ...settingsOverrides,
        ...(options.skipWaitPort ? { skipWaitPort: true } : {}),
        env: {
          ...settings.env,
          ...settingsOverrides?.env,
          ...netlifyConfig?.build.environment,
        },
      },
      cwd,
    })

    settings.frameworkHost = ipVersion === 6 ? '::1' : '127.0.0.1'
    settings.detectFrameworkHost = options.skipWaitPort
  }

  if (timeline === 'build') {
    // Start by cleaning the internal directory, as it may have artifacts left
    // by previous builds.
    await cleanInternalDirectory(site.root)

    // Copy `netlify.toml` into the internal directory. This will be the new
    // location of the config file for the duration of the command.
    const tempConfigPath = await copyConfig(cachedConfig.configPath ?? '', command.workingDir)
    const buildSiteOptions = {
      ...sharedOptions,
      cachedConfig: {
        ...sharedOptions.cachedConfig,
        outputConfigPath: tempConfigPath,
      },
    }

    // Run Netlify Build using the main entry point.
    const { netlifyConfig, success, generatedFunctions } = await buildSite(buildSiteOptions)

    if (!success) {
      return logAndThrowError('Could not start local server due to a build error')
    }

    // Start the dev server, forcing the usage of a static server as opposed to
    // the framework server.
    const settingsOverrides = {
      command: undefined,
      useStaticServer: true,
      dist: undefined,
    }
    if (!options.dir && netlifyConfig?.build?.publish) {
      settingsOverrides.dist = netlifyConfig.build.publish
    }
    await devCommand({ netlifyConfig, settingsOverrides })

    return { configPath: tempConfigPath, generatedFunctions }
  }

  const startDevOptions = {
    ...sharedOptions,

    // Set `quiet` to suppress non-essential output from Netlify Build unless
    // the `debug` flag is set.
    quiet: !options.debug,
    env,
  }

  // Run Netlify Build using the `startDev` entry point.
  const {
    configMutations,
    error: startDevError,
    success,
    generatedFunctions,
  } = await startDev(devCommand, startDevOptions)

  if (!success && startDevError) {
    return logAndThrowError(
      `Could not start local development server\n\n${startDevError.message}\n\n${startDevError.stack}`,
    )
  }

  return { configMutations, generatedFunctions }
}

type RunTimelineOptions = Omit<Parameters<typeof runNetlifyBuild>[0], 'timeline'>

export const runDevTimeline = (options: RunTimelineOptions) => runNetlifyBuild({ ...options, timeline: 'dev' })

export const runBuildTimeline = (options: RunTimelineOptions) => runNetlifyBuild({ ...options, timeline: 'build' })
