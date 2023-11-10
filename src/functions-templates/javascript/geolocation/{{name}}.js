export default async (context) => {
  const { city, country } = context.geo

  return new Response(`Special message for ${city}, ${country}!`)
}
