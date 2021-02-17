const fetch = require('node-fetch')

const getHeaders = ({ token }) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
})

const getErrorMessage = async ({ response }) => {
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    const json = await response.json()
    return json.message
  }
  const text = await response.text()
  return text
}

const checkResponse = async ({ response }) => {
  if (!response.ok) {
    const message = await getErrorMessage({ response }).catch(() => {})
    const errorPostfix = message && message ? ` and message '${message}'` : ''
    throw new Error(`Request failed with status '${response.status}'${errorPostfix}`)
  }
}

const getApiUrl = ({ api }) => `${api.scheme}://${api.host}${api.pathPrefix}`

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
  // TODO: use open-api spec via api when it is exposed
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

const cancelDeploy = async ({ api, deployId, warn }) => {
  try {
    await api.cancelSiteDeploy({ deploy_id: deployId })
  } catch (error) {
    warn(`Failed canceling deploy with id ${deployId}: ${error.message}`)
  }
}

const FIRST_PAGE = 1
const MAX_PAGES = 10
const MAX_PER_PAGE = 100
const listSites = async ({ api, options }) => {
  const { page = FIRST_PAGE, maxPages = MAX_PAGES, ...rest } = options
  const sites = await api.listSites({ page, per_page: MAX_PER_PAGE, ...rest })
  // TODO: use pagination headers when js-client returns them
  if (sites.length === MAX_PER_PAGE && page + 1 <= maxPages) {
    return [...sites, ...(await listSites({ api, options: { page: page + 1, maxPages, ...rest } }))]
  }
  return sites
}

module.exports = { uploadEdgeHandlers, cancelDeploy, listSites }
