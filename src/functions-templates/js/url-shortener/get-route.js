'use strict'

var request = require('request')

module.exports = function handler(event, context, callback) {
  // which URL code are we trying to retrieve?
  var code = event.queryStringParameters['code']

  // where is the data?
  var url =
    'https://api.netlify.com/api/v1/forms/' +
    process.env.ROUTES_FORM_ID +
    '/submissions/?access_token=' +
    process.env.API_AUTH

  request(url, function(err, response, body) {
    // look for this code in our stash
    if (!err && response.statusCode === 200) {
      var routes = JSON.parse(body)

      for (var item in routes) {
        // return the result when we find the match
        if (routes[item].data.code == code) {
          console.log('We searched for ' + code + ' and we found ' + routes[item].data.destination)
          return callback(null, {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: code,
              url: routes[item].data.destination
            })
          })
        }
      }
    } else {
      return callback(null, {
        statusCode: 200,
        body: err
      })
    }
  })
}
