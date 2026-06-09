import { drizzle } from 'drizzle-orm/netlify-db'

import { planets } from '../../../db/schema'

export default async () => {
  try {
    const db = drizzle()
    const rows = await db.select().from(planets)

    return Response.json({ planets: rows })
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)

    return Response.json(
      {
        error: "Couldn't query the database. If you haven't set up the schema yet, run `netlify database init`.",
        details,
      },
      { status: 500 },
    )
  }
}

export const config = {
  path: '/planets',
}
