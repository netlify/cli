'use strict'
const process = require('process')

const Hashids = require('hashids')
const request = require('request')

const NUMBER_TO_CODE = 100

module.exports = function handler(event, context, callback) {
  // Set the root URL according to the Netlify site we are within
  const rootURL = `${process.env.URL}/`

  // get the details of what we are creating
  let destination = event.queryStringParameters.to

  // generate a unique short code (stupidly for now)
  const hash = new Hashids()
  const number = Math.round(new Date().getTime() / NUMBER_TO_CODE)
  const code = hash.encode(number)

  // ensure that a protocol was provided
  if (!destination.includes('://')) {
    destination = `http://${destination}`
  }

  // prepare a payload to post
  const payload = {
    'form-name': 'routes',
    destination,
    code,
    expires: '',
  }

  // post the new route to the Routes form
  request.post({ url: rootURL, formData: payload }, function onResponse(err) {
    const msg = err
      ? `Post to Routes stash failed: ${err}`
      : `Route registered. Site deploying to include it. ${rootURL}${code}`
    console.log(msg)
    // tell the user what their shortcode will be
    return callback(null, {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: rootURL + code }),
    })
  })

  // ENHANCEMENT: check for uniqueness of shortcode
  // ENHANCEMENT: let the user provide their own shortcode
  // ENHANCEMENT: dont' duplicate existing routes, return the current one
  // ENHANCEMENT: allow the user to specify how long the redirect should exist for
}
