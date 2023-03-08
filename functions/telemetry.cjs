const fetch = require('node-fetch')

const TELEMETRY_SERVICE_URL = 'https://cli-telemetry.netlify.engineering'

// This function is a workaround for our inability to redirect traffic to a ntl function in another site
// using redirects (see https://github.com/netlify/cli-telemetry-service/issues/14)
const handler = async function ({ path, httpMethod, headers, body }) {
  const upstreamPath = path.replace(/^\/telemetry\//, '/')

  // Filter out some headers that shouldn't be fwded
  const headersToFilter = ['host']
  const upstreamHeaders = Object.entries(headers)
    .filter(([headerName]) => headersToFilter.find((hToFilter) => hToFilter !== headerName))
    .reduce((resultingHeaders, [headerName, value]) => {
      resultingHeaders[headerName] = value
      return resultingHeaders
    }, {})

  try {
    const response = await fetch(`${TELEMETRY_SERVICE_URL}${upstreamPath}`, {
      method: httpMethod,
      headers: upstreamHeaders,
      body,
    })
    console.log(`Telemetry service responded with ${response.status}`)
  } catch (error) {
    console.error('Telemetry service call failed', error)
  }

  return {
    statusCode: 200,
  }
}

module.exports = {
  handler,
}
