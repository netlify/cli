// eslint-disable-next-line require-await
const handler = async (event) => ({
  statusCode: 200,
  body: JSON.stringify(event),
})

module.exports = { handler }
