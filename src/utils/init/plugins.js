const pluginsList = require('@netlify/plugins-list')
const fetch = require('node-fetch')

const PLUGINS_LIST_URL = 'https://netlify-plugins.netlify.app/plugins.json'
// 1 minute
const PLUGINS_LIST_TIMEOUT = 6e4

const getPluginsList = async () => {
  try {
    const response = await fetch(PLUGINS_LIST_URL, { timeout: PLUGINS_LIST_TIMEOUT })
    return await response.json()
  } catch {
    return pluginsList
  }
}

const getPluginInfo = (list, packageName) => list.find(({ package }) => package === packageName)

const isPluginInstalled = (configPlugins, plugin) =>
  configPlugins.some(({ package: configPlugin }) => configPlugin === plugin)

const getRecommendPlugins = (frameworkPlugins, config) =>
  frameworkPlugins.filter((plugin) => !isPluginInstalled(config.plugins, plugin))

module.exports = { getPluginsList, getPluginInfo, getRecommendPlugins }
