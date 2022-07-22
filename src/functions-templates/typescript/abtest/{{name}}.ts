import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  // look for existing "test_bucket" cookie
  const bucketName = "test_bucket";
  const bucket = context.cookies.get(bucketName);

  // return here if we find a cookie
  if (bucket) {
    return new Response(`Welcome back! You were assigned ${bucketName} **${bucket}** when you last visited the site!`);
  }

  // if no "test_bucket" cookie is found, assign the user to a bucket
  // in this example we're using two buckets (a, b) with an equal weighting of 50/50
  const weighting = 0.5;

  // get a random number between (0-1)
  // this is a basic example and you may want to experiment
  const random = Math.random();
  const newBucketValue = random <= weighting ? "a" : "b";

  // set the new "test_bucket" cookie
  context.cookies.set({
    name: bucketName,
    value: newBucketValue,
  });

  return new Response(
    `Congratulations! You have been assigned ${bucketName} **${newBucketValue}**. View your browser cookies to check it out!`,
  );
};