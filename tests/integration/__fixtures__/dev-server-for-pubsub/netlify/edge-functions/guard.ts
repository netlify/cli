export default async (req: Request) => {
  if (req.headers.get("Authorization") !== "Bearer foo") {
    return new Response("Unauthorized", { status: 401 })
  }
}

export const config = {
  path: "/.netlify/pubsub/*"
}
