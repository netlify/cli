const AnsiToHtml = require('ansi-to-html')

const ansiToHtml = new AnsiToHtml()

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'CLOCKWORK_... Remove this comment to see the full error message
const { CLOCKWORK_USERAGENT } = require('../../utils/index.mjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'formatLamb... Remove this comment to see the full error message
const { formatLambdaError } = require('./utils.cjs')

const buildHelpResponse = ({
  error,
  headers,
  path,
  result
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const acceptsHtml = headers.accept && headers.accept.includes('text/html')

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  const paragraph = (text: $TSFixMe) => {
    text = text.trim()

    if (acceptsHtml) {
      return ansiToHtml.toHtml(`<p>${text}</p>`)
    }

    text = text
      .replace(/<pre><code>/gm, '```\n')
      .replace(/<\/code><\/pre>/gm, '\n```')
      .replace(/<code>/gm, '`')
      .replace(/<\/code>/gm, '`')

    return `${text}\n\n`
  }

  const isSimulatedRequest = headers['user-agent'] === CLOCKWORK_USERAGENT

  let message = ''

  if (!isSimulatedRequest) {
    message += paragraph(`
You performed an HTTP request to <code>${path}</code>, which is a scheduled function.
You can do this to test your functions locally, but it won't work in production.
    `)
  }

  if (error) {
    message += paragraph(`
There was an error during execution of your scheduled function:

<pre><code>${formatLambdaError(error)}</code></pre>`)
  }

  if (result) {
    // lambda emulator adds level field, which isn't user-provided
    const returnValue = { ...result }
    delete returnValue.level

    const { statusCode } = returnValue
    if (statusCode >= 500) {
      message += paragraph(`
Your function returned a status code of <code>${statusCode}</code>.
At the moment, Netlify does nothing about that. In the future, there might be a retry mechanism based on this.
`)
    }

    const allowedKeys = new Set(['statusCode'])
    const returnedKeys = Object.keys(returnValue)
    const ignoredKeys = returnedKeys.filter((key) => !allowedKeys.has(key))

    if (ignoredKeys.length !== 0) {
      message += paragraph(
        `Your function returned ${ignoredKeys
          .map((key) => `<code>${key}</code>`)
          .join(', ')}. Is this an accident? It won't be interpreted by Netlify.`,
      )
    }
  }

  const statusCode = error ? 500 : 200
  return acceptsHtml
    ? {
        statusCode,
        contentType: 'text/html',
        message: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css">\n
                ${message}`,
      }
    : {
        statusCode,
        contentType: 'text/plain',
        message,
      }
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'handleSche... Remove this comment to see the full error message
const handleScheduledFunction = ({
  error,
  request,
  response,
  result
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const { contentType, message, statusCode } = buildHelpResponse({
    error,
    headers: request.headers,
    path: request.path,
    result,
  })

  response.status(statusCode)
  response.set('Content-Type', contentType)
  response.send(message)
}

module.exports = { handleScheduledFunction, buildHelpResponse }
