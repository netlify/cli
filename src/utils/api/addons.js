/* temp api until endpoints in openAPI spec
 TODO update openAPI spec and update `addons` commands
*/
const fetch = require('node-fetch')

async function createAddon(settings, netlifyApiToken) {
  const { siteId, addon, config } = settings
  console.log('Creating addon')
  const url = `https://api.netlify.com/api/v1/sites/${siteId}/services/${addon}/instances`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${netlifyApiToken}`
    },
    body: JSON.stringify({
      config: config
    }),
  })

  const data = await response.json()

  if (response.status === 422) {
    throw new Error(`Error ${JSON.stringify(data)}`)
  }

  return data
}

async function getAddons(siteId, netlifyApiToken) {
  const url = `https://api.netlify.com/api/v1/sites/${siteId}/service-instances`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${netlifyApiToken}`
    }
  })

  const data = await response.json()

  if (response.status === 422) {
    throw new Error(`Error ${JSON.stringify(data)}`)
  }

  return data
}

async function deleteAddon(settings, netlifyApiToken) {
  const { siteId, addon, instanceId } = settings
  console.log('Deleting addon')
  const url = `https://api.netlify.com/api/v1/sites/${siteId}/services/${addon}/instances/${instanceId}`
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${netlifyApiToken}`
    }
  })

  return response
}

async function updateAddon(settings, netlifyApiToken) {
  const { siteId, addon, config, instanceId } = settings
  console.log('Updating addon', addon)
  const url = `https://api.netlify.com/api/v1/sites/${siteId}/services/${addon}/instances/${instanceId}`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${netlifyApiToken}`
    },
    body: JSON.stringify({
      config: config
    }),
  })

  return response
}

module.exports = {
  getAddons: getAddons,
  createAddon: createAddon,
  updateAddon: updateAddon,
  deleteAddon: deleteAddon
}
