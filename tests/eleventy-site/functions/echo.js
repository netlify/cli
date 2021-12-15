// eslint-disable-next-line require-await
export const handler = async (event) => ({
  statusCode: 200,
  body: JSON.stringify(event),
})


