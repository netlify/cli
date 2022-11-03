// @ts-expect-error TS(2307) FIXME: Cannot find module 'https://edge.netlify.com' or i... Remove this comment to see the full error message
import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => context.json({ hello: "world" });