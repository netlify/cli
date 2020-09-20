// This file should be used to wrap API methods that are not part of our open API spec yet
// Once they become part of the spec, js-client should be used
const fetch = require('node-fetch')

const getHeaders = ({ token }) => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

const getErrorMessage = async ({ response }) => {
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.indexOf('application/json') !== -1) {
    const json = await response.json()
    return json.message
  } else {
    const text = await response.text()
    return text
  }
}

const checkResponse = async ({ response }) => {
  if (!response.ok) {
    const message = await getErrorMessage({ response }).catch(() => undefined)
    const errorPostfix = message && message ? ` and message '${message}'` : ''
    throw new Error(`Request failed with status '${response.status}'${errorPostfix}`)
  }
}

const getApiUrl = ({ api }) => {
  return `${api.scheme}://${api.host}${api.pathPrefix}`
}

const apiPost = async ({ api, path, data }) => {
  const apiUrl = getApiUrl({ api })
  const response = await fetch(`${apiUrl}/${path}`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: getHeaders({ token: api.accessToken }),
    agent: api.agent,
  })

  await checkResponse({ response })

  return response
}

const uploadEdgeHandlers = async ({ api, deployId, bundleBuffer, manifest }) => {
  const response = await apiPost({ api, path: `deploys/${deployId}/edge_handlers`, data: manifest })
  const { error, exists, upload_url: uploadUrl } = await response.json()
  if (error) {
    throw new Error(error)
  }

  if (exists) {
    return false
  }

  if (!uploadUrl) {
    throw new Error('Missing upload URL')
  }

  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: bundleBuffer,
    headers: {
      'Content-Type': 'application/javascript',
    },
    agent: api.agent,
  })

  await checkResponse({ response: putResponse })

  return true
}

module.exports = { uploadEdgeHandlers }
