#!/usr/bin/env node
const { Buffer } = require('buffer')
const process = require('process')

/* sync GraphQL schema to your FaunaDB account - use with `netlify dev:exec <path-to-this-file>` */
const createFaunaGraphQL = function () {
  if (!process.env.FAUNADB_SERVER_SECRET) {
    console.log('No FAUNADB_SERVER_SECRET in environment, skipping DB setup')
  }
  console.log('Upload GraphQL Schema!')

  const fetch = require('node-fetch')
  const fs = require('fs')
  const path = require('path')
  // name of your schema file
  const dataString = fs.readFileSync(path.join(__dirname, 'schema.graphql')).toString()

  // encoded authorization header similar to https://www.npmjs.com/package/request#http-authentication
  const token = Buffer.from(`${process.env.FAUNADB_SERVER_SECRET}:`).toString('base64')

  const options = {
    method: 'POST',
    body: dataString,
    headers: { Authorization: `Basic ${token}` },
  }

  fetch('https://graphql.fauna.com/import', options)
    // // uncomment for debugging
    .then((res) => res.text())
    .then((body) => {
      console.log('Netlify Functions:Create - `fauna-graphql/sync-schema.js` success!')
      console.log(body)
    })
    .catch((error) => console.error('something wrong happened:', { err: error }))
}

createFaunaGraphQL()
