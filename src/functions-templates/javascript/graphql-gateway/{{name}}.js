/**
 * This code assumes you have other graphql Netlify functions
 * and shows you how to stitch them together in a "gateway".
 *
 * Of course, feel free to modify this gateway to suit your needs.
 */
const process = require('process')

const { createHttpLink } = require('apollo-link-http')
const { ApolloServer } = require('apollo-server-lambda')
const { introspectSchema, makeRemoteExecutableSchema, mergeSchemas } = require('graphql-tools')
const fetch = require('node-fetch')

const handler = async function (event, context) {
  // other Netlify functions which are graphql lambdas
  const schema1 = await getSchema('graphql-1')
  const schema2 = await getSchema('graphql-2')
  const schemas = [schema1, schema2]

  /**
   * resolving -between- schemas
   * https://www.apollographql.com/docs/graphql-tools/schema-stitching#adding-resolvers
   */
  const linkTypeDefs = `
    extend type Book {
      author: Author
    }
  `
  schemas.push(linkTypeDefs)
  const resolvers = {
    Book: {
      author: {
        fragment: `... on Book { authorName }`,
        resolve(book, args, resolveContext, info) {
          return info.mergeInfo.delegateToSchema({
            schema: schema1,
            operation: 'query',
            // reuse what's implemented in schema1
            fieldName: 'authorByName',
            args: {
              name: book.authorName,
            },
            context: resolveContext,
            info,
          })
        },
      },
    },
  }

  // more docs https://www.apollographql.com/docs/graphql-tools/schema-stitching#api
  const schema = mergeSchemas({
    schemas,
    resolvers,
  })
  const server = new ApolloServer({ schema })
  return new Promise((resolve, reject) => {
    const cb = (err, args) => (err ? reject(err) : resolve(args))
    server.createHandler()(event, context, cb)
  })
}

const getSchema = async function (endpoint) {
  // you can't use relative URLs within Netlify Functions so need a base URL
  // process.env.URL is one of many build env variables:
  // https://docs.netlify.com/configure-builds/environment-variables/
  // Netlify Dev only supports URL and DEPLOY URL for now
  const uri = `${process.env.URL}/.netlify/functions/${endpoint}`
  const link = createHttpLink({ uri, fetch })
  const schema = await introspectSchema(link)
  const executableSchema = makeRemoteExecutableSchema({ schema, link })
  return executableSchema
}

module.exports = { handler }
