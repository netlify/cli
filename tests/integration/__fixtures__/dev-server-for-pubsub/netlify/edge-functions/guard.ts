export default async (req: Request) => {
  // anybody is allowed to read
  if (req.method === "GET") return

  // but only authorized users can write
  if (req.headers.get("Authorization") !== "Bearer foo") {
    return new Response("Unauthorized", { status: 401 })
  }
}

export const config = {
  path: "/.netlify/pubsub/*"
}
