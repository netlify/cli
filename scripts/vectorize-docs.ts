import { createVectorStore } from '../src/lib/cli-docs.js'

try {
  await createVectorStore()
} catch (error) {
  console.error('Error creating vector store:', error)
  throw error
}
