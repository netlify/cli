import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import semver from 'semver';
import { chalk, logAndThrowError, log, version } from '../../utils/command-helpers.js';
const ATTRIBUTES_REGEX = /(\S*)="([^\s"]*)"/gim;
// AI_CONTEXT_BASE_URL is used to help with local testing at non-production
// versions of the context apis.
const BASE_URL = new URL(process.env.AI_CONTEXT_BASE_URL ?? 'https://docs.netlify.com/ai-context').toString();
export const NTL_DEV_MCP_FILE_NAME = 'netlify-development.mdc';
const MINIMUM_CLI_VERSION_HEADER = 'x-cli-min-ver';
export const NETLIFY_PROVIDER = 'netlify';
const PROVIDER_CONTEXT_REGEX = /<providercontext ([^>]*)>(.*)<\/providercontext>/ims;
const PROVIDER_CONTEXT_OVERRIDES_REGEX = /<providercontextoverrides([^>]*)>(.*)<\/providercontextoverrides>/ims;
const PROVIDER_CONTEXT_OVERRIDES_TAG = 'ProviderContextOverrides';
let contextConsumers = [];
export const getContextConsumers = async (cliVersion) => {
    if (contextConsumers.length > 0) {
        return contextConsumers;
    }
    try {
        const res = await fetch(`${BASE_URL}/context-consumers`, {
            headers: {
                'user-agent': `NetlifyCLI ${cliVersion}`,
            },
        });
        if (!res.ok) {
            return [];
        }
        const data = (await res.json());
        contextConsumers = data?.consumers ?? [];
    }
    catch { }
    return contextConsumers;
};
export const downloadFile = async (cliVersion, contextConfig, consumer) => {
    try {
        if (!contextConfig.endpoint) {
            return null;
        }
        const url = new URL(contextConfig.endpoint, BASE_URL);
        url.searchParams.set('consumer', consumer.key);
        if (process.env.AI_CONTEXT_BASE_URL) {
            const overridingUrl = new URL(process.env.AI_CONTEXT_BASE_URL);
            url.host = overridingUrl.host;
            url.port = overridingUrl.port;
            url.protocol = overridingUrl.protocol;
        }
        const res = await fetch(url, {
            headers: {
                'user-agent': `NetlifyCLI ${cliVersion}`,
            },
        });
        if (!res.ok) {
            return null;
        }
        const contents = await res.text();
        const minimumCLIVersion = res.headers.get(MINIMUM_CLI_VERSION_HEADER) ?? undefined;
        return {
            contents,
            minimumCLIVersion,
        };
    }
    catch {
        // no-op
    }
    return null;
};
/**
 * Parses the `<ProviderContext>` and `<ProviderContextOverrides>` blocks in
 * a context file.
 */
export const parseContextFile = (contents) => {
    const result = {
        contents,
    };
    const providerContext = contents.match(PROVIDER_CONTEXT_REGEX);
    if (providerContext) {
        const [, attributes, innerContents] = providerContext;
        result.innerContents = innerContents;
        for (const [, name, value] of attributes.matchAll(ATTRIBUTES_REGEX)) {
            switch (name.toLowerCase()) {
                case 'provider':
                    result.provider = value;
                    break;
                case 'version':
                    result.version = value;
                    break;
                default:
                    continue;
            }
        }
    }
    const contextOverrides = contents.match(PROVIDER_CONTEXT_OVERRIDES_REGEX);
    if (contextOverrides) {
        const [overrideContents, , innerContents] = contextOverrides;
        result.overrides = {
            contents: overrideContents,
            innerContents,
        };
    }
    return result;
};
/**
 * Takes a context file (a template) and injects a string in an overrides block
 * if one is found. Returns the resulting context file.
 */
export const applyOverrides = (template, overrides) => {
    if (!overrides) {
        return template;
    }
    return template
        .replace(PROVIDER_CONTEXT_OVERRIDES_REGEX, `<${PROVIDER_CONTEXT_OVERRIDES_TAG}>${overrides}</${PROVIDER_CONTEXT_OVERRIDES_TAG}>`)
        .trim();
};
/**
 * Reads a file on disk and tries to parse it as a context file.
 */
export const getExistingContext = async (path) => {
    try {
        const stats = await fs.stat(path);
        if (!stats.isFile()) {
            throw new Error(`${path} already exists but is not a file. Please remove it or rename it and try again.`);
        }
        const file = await fs.readFile(path, 'utf8');
        const parsedFile = parseContextFile(file);
        return parsedFile;
    }
    catch (error) {
        const exception = error;
        if (exception.code !== 'ENOENT') {
            throw new Error(`Could not open context file at ${path}: ${exception.message}`);
        }
        return null;
    }
};
export const writeFile = async (path, contents) => {
    const directory = dirname(path);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path, contents);
};
export const deleteFile = async (path) => {
    try {
        // delete file from file system - not just unlinking it
        await fs.rm(path);
    }
    catch {
        // ignore
    }
};
export const downloadAndWriteContextFiles = async (consumer, { command }) => {
    await Promise.allSettled(Object.keys(consumer.contextScopes).map(async (contextKey) => {
        const contextConfig = consumer.contextScopes[contextKey];
        const { contents: downloadedFile, minimumCLIVersion } = (await downloadFile(version, contextConfig, consumer).catch(() => null)) ?? {};
        if (!downloadedFile) {
            return logAndThrowError(`An error occurred when pulling the latest context file for scope ${contextConfig.scope}. Please try again.`);
        }
        if (minimumCLIVersion && semver.lt(version, minimumCLIVersion)) {
            return logAndThrowError(`This command requires version ${minimumCLIVersion} or above of the Netlify CLI. Refer to ${chalk.underline('https://ntl.fyi/update-cli')} for information on how to update.`);
        }
        const absoluteFilePath = resolve(command?.workingDir ?? '', consumer.path, `netlify-${contextKey}.${consumer.ext || 'mdc'}`);
        const existing = await getExistingContext(absoluteFilePath);
        const remote = parseContextFile(downloadedFile);
        let { contents } = remote;
        // Does a file already exist at this path?
        if (existing) {
            // If it's a file we've created, let's check the version and bail if we're
            // already on the latest, otherwise rewrite it with the latest version.
            if (existing.provider?.toLowerCase() === NETLIFY_PROVIDER) {
                if (remote.version === existing.version) {
                    log(`You're all up to date! ${chalk.underline(absoluteFilePath)} contains the latest version of the context files.`);
                    return;
                }
                // We must preserve any overrides found in the existing file.
                contents = applyOverrides(remote.contents, existing.overrides?.innerContents);
            }
            else {
                // Whatever exists in the file goes in the overrides block.
                contents = applyOverrides(remote.contents, existing.contents);
            }
        }
        // we don't want to cut off content, but if we _have_ to
        // then we need to do so before writing or the user's
        // context gets in a bad state. Note, this can result in
        // a file that's not parsable next time. This will be
        // fine because the file will simply be replaced. Not ideal
        // but solves the issue of a truncated file in a bad state
        // being updated.
        if (consumer.truncationLimit && contents.length > consumer.truncationLimit) {
            contents = contents.slice(0, consumer.truncationLimit);
        }
        await writeFile(absoluteFilePath, contents);
        log(`${existing ? 'Updated' : 'Created'} context files at ${chalk.underline(absoluteFilePath)}`);
    }));
};
//# sourceMappingURL=context.js.map