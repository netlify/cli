const { ApolloServer } = require('apollo-server-lambda')
const { createHttpLink } = require('apollo-link-http')
const fetch = require('node-fetch')
const { introspectSchema, makeRemoteExecutableSchema } = require('graphql-tools')

exports.handler = async function(event, context) {
  /** required for Fauna GraphQL auth */
  if (!process.env.FAUNADB_SERVER_SECRET) {
    const msg = `
    FAUNADB_SERVER_SECRET missing. 
    Did you forget to install the fauna addon or forgot to run inside Netlify Dev?
    `
    console.error(msg)
    return {
      statusCode: 500,
      body: JSON.stringify({ msg })
    }
  }
  const b64encodedSecret = Buffer.from(
    process.env.FAUNADB_SERVER_SECRET + ':' // weird but they
  ).toString('base64')
  const headers = { Authorization: `Basic ${b64encodedSecret}` }

  /** standard creation of apollo-server executable schema */
  const link = createHttpLink({
    uri: 'https://graphql.fauna.com/graphql', // modify as you see fit
    fetch,
    headers
  })
  const schema = await introspectSchema(link)
  const executableSchema = makeRemoteExecutableSchema({
    schema,
    link
  })
  const server = new ApolloServer({
    schema: executableSchema
  })
  return new Promise((yay, nay) => {
    const cb = (err, args) => (err ? nay(err) : yay(args))
    server.createHandler()(event, context, cb)
  })
}
