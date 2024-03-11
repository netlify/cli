import { Buffer } from 'buffer';
import path from 'path';
import { BlobsServer } from '@netlify/blobs';
import { v4 as uuidv4 } from 'uuid';
import { log, NETLIFYDEVLOG } from '../../utils/command-helpers.js';
import { getPathInProject } from '../settings.js';
let hasPrintedLocalBlobsNotice = false;
export const BLOBS_CONTEXT_VARIABLE = 'NETLIFY_BLOBS_CONTEXT';
const printLocalBlobsNotice = () => {
    if (hasPrintedLocalBlobsNotice) {
        return;
    }
    hasPrintedLocalBlobsNotice = true;
    log(`${NETLIFYDEVLOG} Netlify Blobs running in sandbox mode for local development. Refer to https://ntl.fyi/local-blobs for more information.`);
};
const startBlobsServer = async (debug, projectRoot, token) => {
    const directory = path.resolve(projectRoot, getPathInProject(['blobs-serve']));
    const server = new BlobsServer({
        debug,
        directory,
        onRequest: () => {
            printLocalBlobsNotice();
        },
        token,
    });
    const { port } = await server.start();
    return { port };
};
/**
 * Starts a local Blobs server and returns a context object that lets functions
 * connect to it.
 */
export const getBlobsContext = async ({ debug, projectRoot, siteID }) => {
    const token = uuidv4();
    const { port } = await startBlobsServer(debug, projectRoot, token);
    const context = {
        deployID: '0',
        edgeURL: `http://localhost:${port}`,
        siteID,
        token,
    };
    return context;
};
/**
 * Returns a Base-64, JSON-encoded representation of the Blobs context. This is
 * the format that the `@netlify/blobs` package expects to find the context in.
 */
export const encodeBlobsContext = (context) => Buffer.from(JSON.stringify(context)).toString('base64');
