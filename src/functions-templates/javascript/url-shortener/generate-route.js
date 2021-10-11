'use strict'
const process = require('process')

const fetch = require('fetch')
const FormData = require('form-data')
const Hashids = require('hashids/cjs')

const NUMBER_TO_CODE = 100

module.exports = async function handler(event) {
  // Set the root URL according to the Netlify site we are within
  const rootURL = `${process.env.URL}/`

  // get the details of what we are creating
  let destination = event.queryStringParameters.to

  // generate a unique short code (stupidly for now)
  const hash = new Hashids()
  const number = Math.round(Date.now() / NUMBER_TO_CODE)
  const code = hash.encode(number)

  // ensure that a protocol was provided
  if (!destination.includes('://')) {
    destination = `http://${destination}`
  }

  // prepare a payload to post
  const form = new FormData()
  form.append('form-name', 'routes')
  form.append('destination', destination)
  form.append('code', code)
  form.append('expires', '')

  // post the new route to the Routes form
  try {
    await fetch(rootURL, { method: 'POST', body: form })
    const url = `${rootURL}${code}`
    console.log(`Route registered. Site deploying to include it. ${url}`)
    // tell the user what their shortcode will be
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }
  } catch (error) {
    return { statusCode: 500, body: `Post to Routes stash failed: ${error.message}` }
  }

  // ENHANCEMENT: check for uniqueness of shortcode
  // ENHANCEMENT: let the user provide their own shortcode
  // ENHANCEMENT: dont' duplicate existing routes, return the current one
  // ENHANCEMENT: allow the user to specify how long the redirect should exist for
}
