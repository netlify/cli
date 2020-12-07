/* Import faunaDB sdk */
const process = require('process')

const { query, Client } = require('faunadb')

const client = new Client({
  secret: process.env.FAUNADB_SERVER_SECRET,
})

const handler = async () => {
  console.log('Function `read-all` invoked')
  return client
    .query(query.Paginate(query.Match(query.Ref('indexes/all_items'))))
    .then((response) => {
      const itemRefs = response.data
      // create new query out of item refs. http://bit.ly/2LG3MLg
      const getAllItemsDataQuery = itemRefs.map((ref) => query.Get(ref))
      // then query the refs
      return client.query(getAllItemsDataQuery).then((ret) => ({
        statusCode: 200,
        body: JSON.stringify(ret),
      }))
    })
    .catch((error) => {
      console.log('error', error)
      return {
        statusCode: 400,
        body: JSON.stringify(error),
      }
    })
}

module.exports = { handler }
