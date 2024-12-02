export default async (req) => {
  const { next_run } = await req.json()

  console.log("Received event! Next invocation at:", next_run)
}

export const config = {
  schedule: "@hourly"
}
