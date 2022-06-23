// Let's serve an image of a kitten from the internet

export default async () => {
  // fetch() is supported natively by Deno!
  // Returning the awaited response automatically sets the
  // content-type headers!
  const kitten = await fetch('https://placekitten.com/g/300/300')
  return kitten
}
