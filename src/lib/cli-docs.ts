import { access, readFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'

import { glob } from 'tinyglobby'
import { log } from '@clack/prompts'
import { MarkdownTextSplitter } from 'langchain/text_splitter'
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib'
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers'

const DOCS_DIR = fileURLToPath(new URL('../../docs', import.meta.url))
const EMBEDDINGS_MODEL_NAME = 'Xenova/all-MiniLM-L6-v2'

const VECTOR_STORE_DIR = fileURLToPath(new URL('../../.vector_store', import.meta.url))

/**
 * Creates a new vector store from documentation files
 * This is meant to be run at package publish time to include as a static file
 */
export const createVectorStore = async (): Promise<void> => {
  log.step('Read Markdown doc files')

  const files = await glob(`${DOCS_DIR}/**/*.md`)
  if (files.length === 0) {
    log.error(`No .md files found in ${DOCS_DIR}`)
    return
  }

  log.info(`Found ${files.length.toString()} files`)

  let allDocs = ''
  for (const file of files) {
    const content = await readFile(file, 'utf8')
    allDocs += content + '\n\n'
  }
  log.info('Done reading files')

  log.step('Create embeddings')

  const splitter = new MarkdownTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  })
  const docs = await splitter.createDocuments([allDocs])
  log.info(`Created ${docs.length.toString()} text chunks`)

  // Use Hugging Face embeddings (local, no API required)
  const embeddings = new HuggingFaceTransformersEmbeddings({
    model: EMBEDDINGS_MODEL_NAME,
  })
  const vectorStore = await HNSWLib.fromDocuments(docs, embeddings)
  log.info('Generated embeddings')

  log.step('Persist to vector store')
  await vectorStore.save(VECTOR_STORE_DIR)

  log.success(`Documentation vector store saved to ${VECTOR_STORE_DIR}`)
}

export const getVectorStore = async (): Promise<HNSWLib> => {
  try {
    await access(VECTOR_STORE_DIR)
  } catch {
    throw new Error('Vector store not found. Something went wrong. Please report this issue.')
  }

  const embeddings = new HuggingFaceTransformersEmbeddings({
    model: EMBEDDINGS_MODEL_NAME,
  })
  const vectorStore = await HNSWLib.load(VECTOR_STORE_DIR, embeddings)

  return vectorStore
}
