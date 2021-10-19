const middy = require('middy')
const { httpErrorHandler, httpHeaderNormalizer, jsonBodyParser, validator } = require('middy/middlewares')

/* Normal lambda code */
const businessLogic = async (event) => {
  // event.body has already been turned into an object by `jsonBodyParser` middleware
  const { name } = event.body
  return {
    statusCode: 200,
    body: JSON.stringify({
      result: 'success',
      message: `Hi ${name} ⊂◉‿◉つ`,
    }),
  }
}

/* Export inputSchema & outputSchema for automatic documentation */
const schema = {
  input: {
    type: 'object',
    properties: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      },
    },
    required: ['body'],
  },
  output: {
    type: 'object',
    properties: {
      body: {
        type: 'string',
        required: ['result', 'message'],
        properties: {
          result: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
    required: ['body'],
  },
}

const handler = middy(businessLogic)
  .use(httpHeaderNormalizer())
  // parses the request body when it's a JSON and converts it to an object
  .use(jsonBodyParser())
  // validates the input
  .use(validator({ inputSchema: schema.input }))
  // handles common http errors and returns proper responses
  .use(httpErrorHandler())

module.exports = {
  schema,
  handler,
}
