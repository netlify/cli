const fetch = require('node-fetch')

async function getAddonManifest(addonName, netlifyApiToken) {
  const url = `https://api.netlify.com/api/v1/services/${addonName}/manifest`
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

module.exports = getAddonManifest
