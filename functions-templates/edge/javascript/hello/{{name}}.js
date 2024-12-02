export default async (req, context) => {
  return new Response("Hello, world!")
}

export const config:Config = {
  path: "/"
}
