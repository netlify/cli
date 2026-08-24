import { getDatabase } from '@netlify/database'

export default async () => {
  try {
    const db = getDatabase()
    const planets = await db.sql`SELECT * FROM planets ORDER BY mass_kg`

    return Response.json({ planets })
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
