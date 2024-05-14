import { Buffer } from 'buffer'
import path from 'path'

import { BlobsServer } from '@netlify/blobs/server'
import { v4 as uuidv4 } from 'uuid'

import { log, NETLIFYDEVLOG } from '../../utils/command-helpers.js'
import { getPathInProject } from '../settings.js'

interface BaseBlobsContext {
  deployID: string
  siteID: string
  primaryRegion?: string
  token: string
}

export interface BlobsContextWithAPIAccess extends BaseBlobsContext {
  apiURL: string
}

export interface BlobsContextWithEdgeAccess extends BaseBlobsContext {
  edgeURL: string
  uncachedEdgeURL: string
}

export type BlobsContext = BlobsContextWithAPIAccess | BlobsContextWithEdgeAccess

let hasPrintedLocalBlobsNotice = false

export const BLOBS_CONTEXT_VARIABLE = 'NETLIFY_BLOBS_CONTEXT'
const DEV_REGION = 'dev'

const printLocalBlobsNotice = () => {
  if (hasPrintedLocalBlobsNotice) {
    return
  }

  hasPrintedLocalBlobsNotice = true

  log(
    `${NETLIFYDEVLOG} Netlify Blobs running in sandbox mode for local development. Refer to https://ntl.fyi/local-blobs for more information.`,
  )
}

/**
 * Starts a local Blobs server on a random port and generates a random token
 * for its authentication.
 */
const initializeBlobsServer = async (projectRoot: string, debug: boolean) => {
  const token = uuidv4()
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
  const url = `http://localhost:${port}`

  return { url, token }
}

interface GetBlobsContextOptions {
  debug: boolean
  projectRoot: string
  siteID: string
}

/**
 * Starts a local Blobs server and returns a context object that lets build
 * plugins connect to it.
 */
export const getBlobsContextWithAPIAccess = async ({ debug, projectRoot, siteID }: GetBlobsContextOptions) => {
  const { token, url } = await initializeBlobsServer(projectRoot, debug)
  const context: BlobsContextWithAPIAccess = {
    apiURL: url,
    deployID: '0',
    primaryRegion: DEV_REGION,
    siteID,
    token,
  }

  return context
}

/**
 * Starts a local Blobs server and returns a context object that lets functions
 * and edge functions connect to it.
 */
export const getBlobsContextWithEdgeAccess = async ({ debug, projectRoot, siteID }: GetBlobsContextOptions) => {
  const { token, url } = await initializeBlobsServer(projectRoot, debug)
  const context: BlobsContextWithEdgeAccess = {
    deployID: '0',
    edgeURL: url,
    siteID,
    token,
    uncachedEdgeURL: url,
    primaryRegion: DEV_REGION,
  }

  return context
}

/**
 * Returns the Blobs metadata that should be added to the Lambda event when
 * invoking a serverless function.
 */
export const getBlobsEventProperty = (context: BlobsContextWithEdgeAccess) => ({
  primary_region: context.primaryRegion,
  url: context.edgeURL,
  url_uncached: context.edgeURL,
  token: context.token,
})

/**
 * Returns a Base-64, JSON-encoded representation of the Blobs context. This is
 * the format that the `@netlify/blobs` package expects to find the context in.
 */
export const encodeBlobsContext = (context: BlobsContext) => Buffer.from(JSON.stringify(context)).toString('base64')
