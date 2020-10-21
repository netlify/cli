const handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify(event),
  }
}

module.exports = { handler }
