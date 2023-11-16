import path from 'path'

import { BlobsServer } from '@netlify/blobs'
import { v4 as uuidv4 } from 'uuid'

import { log, NETLIFYDEVLOG } from '../../utils/command-helpers.js'
import { getPathInProject } from '../settings.js'

let hasPrintedLocalBlobsNotice = false

interface BlobsContext {
  deployID: string
  edgeURL: string
  siteID: string
  token: string
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
  const directory = path.resolve(projectRoot, getPathInProject(['blobs-serves']))
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
  const context: BlobsContext = {
    deployID: '0',
    edgeURL: `http://localhost:${port}`,
    siteID,
    token,
  }

  return context
}
