const isPluginInstalled = (configPlugins, plugin) =>
  configPlugins.some(({ package: configPlugin }) => configPlugin === plugin)

export const getRecommendPlugins = (frameworkPlugins, config) =>
  frameworkPlugins.filter((plugin) => !isPluginInstalled(config.plugins, plugin))

export const getUIPlugins = (configPlugins) =>
  configPlugins.filter(({ origin }) => origin === 'ui').map(({ package: pkg }) => ({ package: pkg }))
