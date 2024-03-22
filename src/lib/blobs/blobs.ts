import { Buffer } from 'buffer'
import path from 'path'

import { BlobsServer } from '@netlify/blobs/server'
import { v4 as uuidv4 } from 'uuid'

import { log, NETLIFYDEVLOG } from '../../utils/command-helpers.js'
import { getPathInProject } from '../settings.js'

let hasPrintedLocalBlobsNotice = false

export const BLOBS_CONTEXT_VARIABLE = 'NETLIFY_BLOBS_CONTEXT'

export interface BlobsContext {
  deployID: string
  edgeURL: string
  siteID: string
  token: string
  uncachedEdgeURL: string
}

const printLocalBlobsNotice = () => {
  if (hasPrintedLocalBlobsNotice) {
    return
  }

  hasPrintedLocalBlobsNotice = true

  log(
    `${NETLIFYDEVLOG} Netlify Blobs running in sandbox mode for local development. Refer to https://ntl.fyi/local-blobs for more information.`,
  )
}

const startBlobsServer = async (debug: boolean, projectRoot: string, token: string) => {
  const directory = path.resolve(projectRoot, getPathInProject(['blobs-serve']))
  const server = new BlobsServer({
    debug,
    directory,
    onRequest: () => {
      printLocalBlobsNotice()
    },
    token,
  })
  const { port } = await server.start()

  return { port }
}

interface GetBlobsContextOptions {
  debug: boolean
  projectRoot: string
  siteID: string
}

/**
 * Starts a local Blobs server and returns a context object that lets functions
 * connect to it.
 */
export const getBlobsContext = async ({ debug, projectRoot, siteID }: GetBlobsContextOptions) => {
  const token = uuidv4()
  const { port } = await startBlobsServer(debug, projectRoot, token)
  const url = `http://localhost:${port}`
  const context: BlobsContext = {
    deployID: '0',
    edgeURL: url,
    siteID,
    token,
    uncachedEdgeURL: url,
  }

  return context
}

/**
 * Returns a Base-64, JSON-encoded representation of the Blobs context. This is
 * the format that the `@netlify/blobs` package expects to find the context in.
 */
export const encodeBlobsContext = (context: BlobsContext) => Buffer.from(JSON.stringify(context)).toString('base64')
