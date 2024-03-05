export default async (request, context) => {
  // Return an internal image using context.rewrite()
  // This image is stored in the /public directory of this project

  // return context.rewrite("/apple-touch-icon.png");

  // OR

  // Use fetch() and return the image response
  const kitten = await fetch('https://placekitten.com/g/300/300')
  return kitten
}
