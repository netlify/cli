// code walkthrough: https://www.netlify.com/blog/2018/03/29/jamstack-architecture-on-netlify-how-identity-and-functions-work-together/#updating-user-data-with-the-identity-api
// demo repo: https://github.com/biilmann/testing-slack-tutorial/tree/v3-one-message-an-hour
// note: requires SLACK_WEBHOOK_URL environment variable
const process = require('process')

const slackURL = process.env.SLACK_WEBHOOK_URL
const fetch = require('node-fetch')

class IdentityAPI {
  constructor(apiURL, token) {
    this.apiURL = apiURL
    this.token = token
  }

  headers(headers = {}) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      ...headers,
    }
  }

  parseJsonResponse(response) {
    return response.json().then((json) => {
      if (!response.ok) {
        const error = `JSON: ${JSON.stringify(json)}. Status: ${response.status}`
        return Promise.reject(new Error(error))
      }

      return json
    })
  }

  request(path, options = {}) {
    const headers = this.headers(options.headers || {})
    return fetch(this.apiURL + path, { ...options, headers }).then((response) => {
      const contentType = response.headers.get('Content-Type')
      if (contentType && contentType.match(/json/)) {
        return this.parseJsonResponse(response)
      }

      if (!response.ok) {
        return response.text().then((data) => {
          const error = `Data: ${data}. Status: ${response.status}`
          return Promise.reject(new Error(error))
        })
      }
      return response.text()
    })
  }
}

//
// Fetch a user from GoTrue via id
//
const fetchUser = function (identity, id) {
  const api = new IdentityAPI(identity.url, identity.token)
  return api.request(`/admin/users/${id}`)
}

//
// Update the app_metadata of a user
//
const updateUser = function (identity, user, appMetadata) {
  const api = new IdentityAPI(identity.url, identity.token)

  return api.request(`/admin/users/${user.id}`, {
    method: 'PUT',
    body: JSON.stringify({ app_metadata: { ...user.app_metadata, ...appMetadata } }),
  })
}

// One hour
const MESSAGE_RATE_LIMIT = 36e5

module.exports = function handler(event, context, callback) {
  if (event.httpMethod !== 'POST') {
    return callback(null, {
      statusCode: 410,
      body: 'Unsupported Request Method',
    })
  }

  const claims = context.clientContext && context.clientContext.user
  if (!claims) {
    return callback(null, {
      statusCode: 401,
      body: 'You must be signed in to call this function',
    })
  }

  fetchUser(context.clientContext.identity, claims.sub).then((user) => {
    const lastMessage = new Date(user.app_metadata.last_message_at || 0).getTime()
    const cutOff = new Date().getTime() - MESSAGE_RATE_LIMIT
    if (lastMessage > cutOff) {
      return callback(null, {
        statusCode: 401,
        body: 'Only one message an hour allowed',
      })
    }

    try {
      const payload = JSON.parse(event.body)

      fetch(slackURL, {
        method: 'POST',
        body: JSON.stringify({
          text: payload.text,
          attachments: [{ text: `From ${user.email}` }],
        }),
      })
        .then(() =>
          updateUser(context.clientContext.identity, user, {
            last_message_at: new Date().getTime(),
          }),
        )
        .then(() => {
          callback(null, { statusCode: 204 })
        })
        .catch((error) => {
          callback(null, {
            statusCode: 500,
            body: `Internal Server Error: ${error}`,
          })
        })
    } catch (error) {
      return callback(null, { statusCode: 500, body: `Internal Server Error: ${error}` })
    }
  })
}
