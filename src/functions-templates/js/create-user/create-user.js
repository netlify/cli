const fetch = require('node-fetch')

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 400, body: 'Must POST to this function' }

  // send account information along with the POST
  const { email, password, full_name } = JSON.parse(event.body)
  if (!email) return { statusCode: 400, body: 'email missing' }
  if (!password) return { statusCode: 400, body: 'password missing' }
  if (!full_name) return { statusCode: 400, body: 'full_name missing' }

  // identity.token is a short lived admin token which
  // is provided to all Netlify Functions to interact
  // with the Identity API
  const { identity } = context.clientContext

  await fetch(`${identity.url}/admin/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${identity.token}` },
    body: JSON.stringify({
      email,
      password,
      confirm: true,
      user_metadata: {
        full_name,
      },
    }),
  })

  return {
    statusCode: 200,
    body: 'success!',
  }
}
