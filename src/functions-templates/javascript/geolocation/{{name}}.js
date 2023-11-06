export default async (context) => {
     const { city } = context.geo.city

    return new Response(`Hello ${city}!`)
}