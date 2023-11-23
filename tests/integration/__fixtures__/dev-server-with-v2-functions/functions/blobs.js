import { getStore } from '@netlify/blobs'

export default async (req) => {
  const store = getStore('my-store')
  const metadata = {
    name: 'Netlify',
    features: {
      blobs: true,
      functions: true,
    },
  }

  await store.set('my-key', 'hello world', { metadata })

  const entry = await store.getWithMetadata('my-key')

  return Response.json(entry)
}

export const config = {
  path: '/blobs',
}
