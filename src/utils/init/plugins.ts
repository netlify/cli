import type { NormalizedCachedConfigConfig } from '../command-helpers.js'
import type { Plugin } from '../types.js'

const isPluginInstalled = (configPlugins: Plugin[], pluginName: string): boolean =>
  configPlugins.some(({ package: configPlugin }) => configPlugin === pluginName)

export const getRecommendPlugins = (frameworkPlugins: string[], config: NormalizedCachedConfigConfig): string[] =>
  frameworkPlugins.filter((plugin) => !isPluginInstalled(config.plugins ?? [], plugin))

export const getUIPlugins = (configPlugins: Plugin[]): { package: string }[] =>
  configPlugins.filter(({ origin }) => origin === 'ui').map(({ package: pkg }) => ({ package: pkg }))
