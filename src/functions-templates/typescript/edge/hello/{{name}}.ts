// eslint-disable-next-line require-await
const hello = async (Request) => new Response("Hello, World!", { headers: { "content-type": "text/html" }});

module.exports = { hello }