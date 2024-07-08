/* eslint-disable default-param-last */
import { Settings } from '@netlify/build-info'
import { isCI } from 'ci-info'
import Enquirer from 'enquirer'
import fuzzy from 'fuzzy'

import BaseCommand from '../commands/base-command.js'

import { chalk, log } from './command-helpers.js'

/**
 * Filters the enquirer settings based on the input
 */
const filterSettings = function (
  scriptEnquirerOptions: ReturnType<typeof formatSettingsArrForEnquirer>,
  input: string,
) {
  const filterOptions = scriptEnquirerOptions.map((scriptEnquirerOption) => scriptEnquirerOption.name)
  // TODO: remove once https://github.com/sindresorhus/eslint-plugin-unicorn/issues/1394 is fixed
  // eslint-disable-next-line unicorn/no-array-method-this-argument
  const filteredSettings = fuzzy.filter(input, filterOptions)
  const filteredSettingNames = new Set(
    filteredSettings.map((filteredSetting) => (input ? filteredSetting.string : filteredSetting)),
  )
  return scriptEnquirerOptions.filter((t) => filteredSettingNames.has(t.name))
}

/**
 * Formats the settings to present it as an array for the enquirer input so that it can choose one
 */
const formatSettingsArrForEnquirer = function (settings: Settings[], type = 'dev') {
  return settings.map((setting) => {
    const cmd = type === 'dev' ? setting.devCommand : setting.buildCommand
    return {
      name: `[${chalk.yellow(setting.framework.name)}] '${cmd}'`,
      value: { ...setting, commands: [cmd] },
      short: `${setting.name}-${cmd}`,
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
    const scriptEnquirerOptions = formatSettingsArrForEnquirer(settings, type)
    const { chosenSettings } = await Enquirer.prompt<{ chosenSettings: Settings }>({
      name: 'chosenSettings',
      message: `Multiple possible ${type} commands found`,
      type: 'autocomplete',
      // @ts-expect-error Add enquirer types
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      suggest(input = '', _choices: any) {
        if (!input) return scriptEnquirerOptions
        // only show filtered results
        return filterSettings(scriptEnquirerOptions, input)
      },
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
