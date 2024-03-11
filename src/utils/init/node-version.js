import { readFile } from 'fs/promises';
import { locatePath } from 'locate-path';
import nodeVersionAlias from 'node-version-alias';
import { warn } from '../command-helpers.js';
const DEFAULT_NODE_VERSION = '12.18.0';
const NVM_FLAG_PREFIX = '--';
// to support NODE_VERSION=--lts, etc.
// @ts-expect-error TS(7006) FIXME: Parameter 'version' implicitly has an 'any' type.
const normalizeConfiguredVersion = (version) => version.startsWith(NVM_FLAG_PREFIX) ? version.slice(NVM_FLAG_PREFIX.length) : version;
// @ts-expect-error TS(7031) FIXME: Binding element 'baseDirectory' implicitly has an ... Remove this comment to see the full error message
export const detectNodeVersion = async ({ baseDirectory, env }) => {
    try {
        const nodeVersionFile = await locatePath(['.nvmrc', '.node-version'], { cwd: baseDirectory });
        const configuredVersion = nodeVersionFile === undefined ? env.NODE_VERSION?.value : await readFile(nodeVersionFile, 'utf8');
        const version = configuredVersion === undefined || configuredVersion === null
            ? DEFAULT_NODE_VERSION
            : await nodeVersionAlias(normalizeConfiguredVersion(configuredVersion));
        return version;
    }
    catch (error) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        warn(`Failed detecting Node.js version: ${error.message}`);
        return DEFAULT_NODE_VERSION;
    }
};
