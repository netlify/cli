const { Buffer } = require('buffer')
const process = require('process')

const { createHttpLink } = require('apollo-link-http')
const { ApolloServer } = require('apollo-server-lambda')
const { introspectSchema, makeRemoteExecutableSchema } = require('graphql-tools')
const fetch = require('node-fetch')

const handler = async function (event, context) {
  /** required for Fauna GraphQL auth */
  if (!process.env.FAUNADB_SERVER_SECRET) {
    const msg = `
    FAUNADB_SERVER_SECRET missing.
    Did you forget to install the fauna addon or forgot to run inside Netlify Dev?
    `
    console.error(msg)
    return {
      statusCode: 500,
      body: JSON.stringify({ msg }),
    }
  }
  const b64encodedSecret = Buffer.from(`${process.env.FAUNADB_SERVER_SECRET}:`).toString('base64')
  const headers = { Authorization: `Basic ${b64encodedSecret}` }

  /** standard creation of apollo-server executable schema */
  const link = createHttpLink({
    // modify as you see fit
    uri: 'https://graphql.fauna.com/graphql',
    fetch,
    headers,
  })
  const schema = await introspectSchema(link)
  const executableSchema = makeRemoteExecutableSchema({
    schema,
    link,
  })
  const server = new ApolloServer({
    schema: executableSchema,
  })
  return new Promise((resolve, reject) => {
    const cb = (err, args) => (err ? reject(err) : resolve(args))
    server.createHandler()(event, context, cb)
  })
}

module.exports = { handler }
