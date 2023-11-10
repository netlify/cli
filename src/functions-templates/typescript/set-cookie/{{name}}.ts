import type { Context } from "@netlify/functions";

export default async (request: Request, context: Context) => {
  if (context.cookies.get("chocolate")) {
		return new Response("Sorry, no more cookies for you")
	}

	context.cookies.set("chocolate", "yummy")

	return new Response("Here's a chocolate cookie! 🍪")
}
