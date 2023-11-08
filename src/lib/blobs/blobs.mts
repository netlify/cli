import path from 'path'

import { BlobsServer } from '@netlify/blobs'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'uuid... Remove this comment to see the full error message
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
// @ts-expect-error TS(7031) FIXME: Binding element 'debug' implicitly has an 'any' ty... Remove this comment to see the full error message
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

// @ts-expect-error TS(7031) FIXME: Binding element 'debug' implicitly has an 'any' ty... Remove this comment to see the full error message
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
