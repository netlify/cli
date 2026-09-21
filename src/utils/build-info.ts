import type { Settings } from '@netlify/build-info'
import { isCI } from 'ci-info'

import type BaseCommand from '../commands/base-command.js'
import { chalk, log } from './command-helpers.js'
import { promptAutocomplete } from './prompts/index.js'
import type { DefaultConfig } from '../lib/build.js'

/**
 * Formats the settings as prompt options so that the user can choose one
 */
const formatSettingsOptions = function (settings: Settings[], type = 'dev') {
  return settings.map((setting) => {
    const cmd = type === 'dev' ? setting.devCommand : setting.buildCommand
    return {
      label: `[${chalk.yellow(setting.framework.name)}] '${cmd}'`,
      value: { ...setting, commands: [cmd] },
    }
  })
}

/**
 * Detects and filters the build setting for a project and a command
 */
export async function detectBuildSettings(command: BaseCommand): Promise<Settings[]> {
  const { project, workspacePackage } = command
  const buildSettings = await project.getBuildSettings(project.workspace ? workspacePackage : '')
  return buildSettings
    .filter((setting) => {
      if (project.workspace && project.relativeBaseDirectory && setting.packagePath) {
        return project.relativeBaseDirectory.startsWith(setting.packagePath)
      }
      return true
    })
    .filter((setting) => setting.devCommand)
}

/**
 * Uses `@netlify/build-info` to detect the dev settings and port based on the framework
 * and the build system that is used.
 * @param command The base command
 * @param type The type of command (dev or build)
 */
export const detectFrameworkSettings = async (
  command: BaseCommand,
  type: 'dev' | 'build' = 'dev',
): Promise<Settings | undefined> => {
  const { relConfigFilePath } = command.netlify
  const settings = await detectBuildSettings(command)
  if (settings.length === 1) {
    return settings[0]
  }

  if (type === 'build' && command.netlify.config?.build?.command?.length) {
    return {
      ...settings[0],
      buildCommand: command.netlify.config.build.command,
    }
  }
  if (type === 'dev' && command.netlify.config?.dev?.command?.length) {
    return {
      ...settings[0],
      devCommand: command.netlify.config.dev.command,
    }
  }

  if (settings.length > 1) {
    if (isCI) {
      log(`Multiple possible ${type} commands found`)
      throw new Error(
        `Detected commands for: ${settings
          .map((setting) => setting.framework.name)
          .join(
            ', ',
          )}. Update your settings to specify which to use. Refer to https://ntl.fyi/dev-monorepo for more information.`,
      )
    }

    // multiple matching detectors, make the user choose
    const chosenSettings = await promptAutocomplete({
      message: `Multiple possible ${type} commands found`,
      options: formatSettingsOptions(settings, type),
    })

    log(`
Update your ${relConfigFilePath} to avoid this selection prompt next time:

[build]
command = "${chosenSettings.buildCommand}"
publish = "${chosenSettings.dist}"

[dev]
command = "${chosenSettings.devCommand}"
`)
    return chosenSettings
  }
}

/**
 * Generates a defaultConfig for @netlify/build based on the settings from the heuristics
 * Returns the defaultConfig in the format that @netlify/build expects (json version of toml)
 * @param settings The settings from the heuristics
 */
export const getDefaultConfig = (settings?: Settings): DefaultConfig | undefined => {
  if (!settings) {
    return undefined
  }

  const config: DefaultConfig = { build: {} }

  if (settings.buildCommand) {
    config.build.command = settings.buildCommand
    config.build.commandOrigin = 'default'
  }

  if (settings.dist) {
    config.build.publish = settings.dist
    config.build.publishOrigin = 'default'
  }

  config.plugins = settings.plugins_recommended?.map((plugin) => ({ package: plugin, origin: 'default' })) || []

  return config
}
