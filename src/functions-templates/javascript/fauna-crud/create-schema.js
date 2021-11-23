#!/usr/bin/env node
const process = require('process')

/* bootstrap database in your FaunaDB account - use with `netlify dev:exec <path-to-this-file>` */
const { Client, query } = require('faunadb')

const createFaunaDB = async function () {
  if (!process.env.FAUNADB_SERVER_SECRET) {
    console.log('No FAUNADB_SERVER_SECRET in environment, skipping DB setup')
  }
  console.log('Create the database!')
  const client = new Client({
    secret: process.env.FAUNADB_SERVER_SECRET,
  })

  /* Based on your requirements, change the schema here */
  try {
    await client.query(query.CreateCollection({ name: 'items' }))

    console.log('Created items class')
    return await client.query(
      query.CreateIndex({
        name: 'all_items',
        source: query.Collection('items'),
        active: true,
      }),
    )
  } catch (error) {
    if (error.requestResult.statusCode === 400 && error.message === 'instance not unique') {
      console.log('DB already exists')
    }
    throw error
  }
}

createFaunaDB()
