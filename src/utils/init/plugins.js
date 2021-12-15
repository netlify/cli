import fetch from 'node-fetch'

// TODO: use static `import` after migrating this repository to pure ES modules
const netlifyPluginsList = import('@netlify/plugins-list')

// 1 minute
const PLUGINS_LIST_TIMEOUT = 6e4

export const getPluginsList = async () => {
  const { pluginsList, pluginsUrl } = await netlifyPluginsList
  try {
    const response = await fetch(pluginsUrl, { timeout: PLUGINS_LIST_TIMEOUT })
    return await response.json()
  } catch {
    return pluginsList
  }
}

export const getPluginInfo = (list, packageName) => list.find((plugin) => plugin.package === packageName)

const isPluginInstalled = (configPlugins, plugin) =>
  configPlugins.some(({ package: configPlugin }) => configPlugin === plugin)

export const getRecommendPlugins = (frameworkPlugins, config) =>
  frameworkPlugins.filter((plugin) => !isPluginInstalled(config.plugins, plugin))

export const getPluginsToInstall = ({ installSinglePlugin, plugins, recommendedPlugins }) => {
  if (Array.isArray(plugins)) {
    return plugins.map((plugin) => ({ package: plugin }))
  }

  return installSinglePlugin === true ? [{ package: recommendedPlugins[0] }] : []
}

export const getUIPlugins = (configPlugins) =>
  configPlugins.filter(({ origin }) => origin === 'ui').map((plugin) => ({ package: plugin.package }))
