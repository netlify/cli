export default async (request, context) => {
  return new Response("Hello, world!")
}

export const config:Config = {
  path: "/"
}