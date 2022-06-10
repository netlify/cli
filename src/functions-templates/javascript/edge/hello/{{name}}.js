// eslint-disable-next-line no-undef
const hello = async () => new Response('Hello, World!', { headers: { 'content-type': 'text/html' } })

module.exports = { hello }
