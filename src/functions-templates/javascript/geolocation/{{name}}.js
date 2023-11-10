export default async (context) => {
  const { city } = context.geo.city

  return new Response(`Special message for ${city}!`)
}
