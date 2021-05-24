const fetch = require('node-fetch')

const TELEMETRY_SERVICE_URL = 'https://cli-telemetry.netlify.engineering'

// This function is a workaround for our inability to redirect traffic to a ntl function in another site
// using redirects (see https://github.com/netlify/cli-telemetry-service/issues/14)
const handler = async function ({ path, httpMethod, headers, body }, context) {
  const upstreamPath = path.replace(/^\/telemetry\//, '/')

  // Filter out some headers that shouldn't be fwded
  const headersToFilter = ['host']
  const upstreamHeaders = Object.entries(headers)
    .filter(([headerName]) => headersToFilter.find((hToFilter) => hToFilter !== headerName))
    .reduce((resultingHeaders, [headerName, value]) => {
      resultingHeaders[headerName] = value
      return resultingHeaders
    }, {})

  const response = fetch(`${TELEMETRY_SERVICE_URL}${upstreamPath}`, {
    method: httpMethod,
    headers: upstreamHeaders,
    body,
  })

  // We don't wait for the telemetry service response because the CLI does not care about
  // it. We want to return as soon and as fast as possible while making these requests in
  // the background.
  context.callbackWaitsForEmptyEventLoop = false
  response
    // eslint-disable-next-line promise/prefer-await-to-then
    .then((res) => console.log(`Telemetry service responded with ${res.status}`))
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    .catch((error) => console.error('Telemetry service call failed', error))

  return {
    statusCode: 200,
  }
}

module.exports = {
  handler,
}
