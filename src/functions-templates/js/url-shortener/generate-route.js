'use strict'

var request = require('request')
var Hashids = require('hashids')

module.exports = function handler(event, context, callback) {
  // Set the root URL according to the Netlify site we are within
  var rootURL = process.env.URL + '/'

  // get the details of what we are creating
  var destination = event.queryStringParameters['to']

  // generate a unique short code (stupidly for now)
  var hash = new Hashids()
  var number = Math.round(new Date().getTime() / 100)
  var code = hash.encode(number)

  // ensure that a protocol was provided
  if (destination.indexOf('://') == -1) {
    destination = 'http://' + destination
  }

  // prepare a payload to post
  var payload = {
    'form-name': 'routes',
    destination,
    code,
    'expires': '',
  }

  // post the new route to the Routes form
  request.post({ url: rootURL, formData: payload }, function(err, httpResponse, body) {
    var msg
    if (err) {
      msg = 'Post to Routes stash failed: ' + err
    } else {
      msg = 'Route registered. Site deploying to include it. ' + rootURL + code
    }
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
