const fetch = require('node-fetch')
exports.handler = async function() {
  try {
    const response = await fetch('https://icanhazdadjoke.com', {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      // NOT res.status >= 200 && res.status < 300
      return { statusCode: response.status, body: response.statusText }
    }
    const data = await response.json()

    return {
      statusCode: 200,
      body: JSON.stringify({ msg: data.joke }),
    }
  } catch (error) {
    console.log(error) // output to netlify function log
    return {
      statusCode: 500,
      body: JSON.stringify({ msg: error.message }), // Could be a custom message or object i.e. JSON.stringify(err)
    }
  }
}
