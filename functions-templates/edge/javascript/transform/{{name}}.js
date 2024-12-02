export default async (request, context) => {
  // this will capture all the requests to all paths and will uppercase them

  const downstreamResponse = await context.next();
  const responseBody = await downstreamResponse.text();
  return new Response(responseBody.toUpperCase());
};

export const config = {
  path: "/*"
}