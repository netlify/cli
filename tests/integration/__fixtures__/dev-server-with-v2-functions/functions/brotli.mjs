import { brotliCompressSync } from 'node:zlib'

export default async () => {
  const text = "What's 🍞🏄‍♀️? A breadboard!".repeat(100)
  const buffer = new TextEncoder().encode(text)
  const brotli = brotliCompressSync(buffer)
  return new Response(brotli, {
    status: 200,
    headers: {
      'Content-Encoding': 'br',
    },
  })
}
