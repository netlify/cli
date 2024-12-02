import { Request, Config } from "@netlify/edge-functions"

export default async (request: Request) => {
  return new Response("Hello, World!");
};

export const config:Config = {
  path: "/"
}