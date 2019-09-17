// for a full working demo check https://express-via-functions.netlify.com/.netlify/functions/serverless-http
const serverless = require('serverless-http')
const expressApp = require('./app')

// We need to define our function name for express routes to set the correct base path
const functionName = 'serverless-http'

// Initialize express app
const app = expressApp(functionName)

// Export lambda handler
exports.handler = serverless(app)
