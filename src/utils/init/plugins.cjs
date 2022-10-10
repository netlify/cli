const isPluginInstalled = (configPlugins, plugin) =>
  configPlugins.some(({ package: configPlugin }) => configPlugin === plugin)

const getRecommendPlugins = (frameworkPlugins, config) =>
  frameworkPlugins.filter((plugin) => !isPluginInstalled(config.plugins, plugin))

const getUIPlugins = (configPlugins) =>
  configPlugins.filter(({ origin }) => origin === 'ui').map(({ package }) => ({ package }))

module.exports = { getRecommendPlugins, getUIPlugins }
