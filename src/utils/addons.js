const { getAddons, createAddon } = require('netlify/src/addons')

module.exports.createSiteAddon = async function(accessToken, addonName, siteId, siteData, log) {
  const addons = await getAddons(siteId, accessToken)
  if (typeof addons === 'object' && addons.error) {
    log('API Error', addons)
    return false
  }

  const currentAddon = addons.find(addon => addon.service_path === `/.netlify/${addonName}`)
  if (currentAddon && currentAddon.id) {
    log(`The "${addonName} add-on" already exists for ${siteData.name}`)
    return false
  }

  const created = await actuallyCreateSiteAddon({
    addonName,
    settings: {
      siteId,
      addon: addonName,
      config: {},
    },
    accessToken,
    siteData,
    log,
  })
  return created
}

async function actuallyCreateSiteAddon({ addonName, settings, accessToken, siteData, log }) {
  const addonResponse = await createAddon(settings, accessToken)
  if (addonResponse.code === 404) {
    log(`No add-on "${addonName}" found. Please double check your add-on name and try again`)
    return false
  }
  log(`Add-on "${addonName}" created for ${siteData.name}`)
  if (addonResponse.config && addonResponse.config.message) {
    log()
    log(`${addonResponse.config.message}`)
  }
  return true
}
