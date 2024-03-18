import { FunctionsRegistry } from './registry.js';
export declare const createHandler: (options: any) => (request: any, response: any) => Promise<void>;
/**
 *
 * @param {object} options
 * @param {import("../blobs/blobs.js").BlobsContext} options.blobsContext
 * @param {import('../../commands/base-command.js').default} options.command
 * @param {*} options.capabilities
 * @param {*} options.config
 * @param {boolean} options.debug
 * @param {*} options.loadDistFunctions
 * @param {*} options.settings
 * @param {*} options.site
 * @param {*} options.siteInfo
 * @param {string} options.siteUrl
 * @param {*} options.timeouts
 * @returns {Promise<import('./registry.js').FunctionsRegistry | undefined>}
 */
export declare const startFunctionsServer: (options: any) => Promise<FunctionsRegistry | undefined>;
//# sourceMappingURL=server.d.ts.map