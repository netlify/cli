import path from 'path'

import { BlobsServer } from '@netlify/blobs'
import { v4 as uuidv4 } from 'uuid'

import { getPathInProject } from '../settings.mjs'

/**
 * @typedef BlobsContext
 * @type {object}
 * @property {string} edgeURL
 * @property {string} deployID
 * @property {string} siteID
 * @property {string} token
 */

/**
 * Starts a local Blobs server and returns a context object that lets functions
 * connect to it.
 *
 * @param {object} options
 * @param {boolean} options.debug
 * @param {string} options.projectRoot
 * @param {string} options.siteID
 * @returns {Promise<BlobsContext>}
 */
export const getBlobsContext = async ({ debug, projectRoot, siteID }) => {
  const token = uuidv4()
  const { port } = await startBlobsServer({ debug, projectRoot, token })
  const context = {
    deployID: '0',
    edgeURL: `http://localhost:${port}`,
    siteID,
    token,
  }

  return context
}

const startBlobsServer = async ({ debug, projectRoot, token }) => {
  const directory = path.resolve(projectRoot, getPathInProject(['blobs']))
  const server = new BlobsServer({
    debug,
    directory,
    token,
  })
  const { port } = await server.start()

  return { port }
}
