// with thanks to https://github.com/vnovick/netlify-function-example/blob/master/functions/bad-words.js
const axios = require('axios')
const Filter = require('bad-words')
const filter = new Filter()
const hgeEndpoint = 'https://live-coding-netlify.herokuapp.com'

const query = `
mutation verifiedp($id: uuid!, $title: String!, $content: String!) {
  update_posts(_set: { verified: true, content: $content, title: $title }, 
    where:{ id: { _eq: $id } }) {
    returning {
      id
    }
  }
}
`

exports.handler = async (event, context) => {
  let request
  try {
    request = JSON.parse(event.body)
  } catch (e) {
    return { statusCode: 400, body: 'c annot parse hasura event' }
  }

  const variables = {
    id: request.event.data.new.id,
    title: filter.clean(request.event.data.new.title),
    content: filter.clean(request.event.data.new.content)
  }
  try {
    await axios.post(hgeEndpoint + '/v1alpha1/graphql', { query, variables })
    return { statusCode: 200, body: 'success' }
  } catch (err) {
    return { statusCode: 500, body: err.toString() }
  }
}
