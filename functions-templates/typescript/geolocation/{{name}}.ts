import { Context } from 'https://edge.netlify.com'

export default async (request: Request, context: Context) =>
  // Here's what's available on context.geo

  // context: {
  //   geo: {
  //     city?: string;
  //     country?: {
  //       code?: string;
  //       name?: string;
  //     },
  //     subdivision?: {
  //       code?: string;
  //       name?: string;
  //     },
  //   }
  // }

  Response.json({
    geo: context.geo,
    header: request.headers.get('x-nf-geo'),
  })
