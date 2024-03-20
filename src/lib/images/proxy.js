import express from 'express';
import { createIPX, ipxFSStorage, ipxHttpStorage, createIPXNodeServer } from 'ipx';
import { log, NETLIFYDEVERR } from '../../utils/command-helpers.js';
import { getProxyUrl } from '../../utils/proxy.js';
export const IMAGE_URL_PATTERN = '/.netlify/images';
// @ts-expect-error TS(7006) FIXME: Parameter 'config' implicitly has an 'any' type.
export const parseAllDomains = function (config) {
    const remoteDomains = [];
    const errors = [];
    const domains = config?.images?.remote_images;
    if (!domains) {
        return { errors, remoteDomains };
    }
    for (const patternString of domains) {
        try {
            const url = new URL(patternString);
            if (url.hostname) {
                remoteDomains.push(url.hostname);
            }
            else {
                errors.push({ message: `The URL '${patternString}' does not have a valid hostname.` });
            }
        }
        catch (error) {
            if (error instanceof Error) {
                errors.push({ message: `Invalid URL '${patternString}': ${error.message}` });
            }
            else {
                errors.push({ message: `Invalid URL '${patternString}': An unknown error occurred` });
            }
        }
    }
    return { errors, remoteDomains };
};
const getErrorMessage = function ({ message }) {
    return message;
};
export const handleImageDomainsErrors = async function (errors) {
    if (errors.length === 0) {
        return;
    }
    const errorMessage = await errors.map(getErrorMessage).join('\n\n');
    log(NETLIFYDEVERR, `Image domains syntax errors:\n${errorMessage}`);
};
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
export const parseRemoteImageDomains = async function ({ config }) {
    if (!config) {
        return [];
    }
    const { errors, remoteDomains } = await parseAllDomains(config);
    await handleImageDomainsErrors(errors);
    return remoteDomains;
};
export const isImageRequest = function (req) {
    return req.url.startsWith(IMAGE_URL_PATTERN);
};
export const transformImageParams = function (query) {
    const params = {};
    const width = query.w || query.width || null;
    const height = query.h || query.height || null;
    if (width && height) {
        // eslint-disable-next-line id-length
        params.s = `${width}x${height}`;
    }
    else {
        // eslint-disable-next-line id-length
        params.w = width;
        // eslint-disable-next-line id-length
        params.h = height;
    }
    params.quality = query.q || query.quality || null;
    params.format = query.fm || null;
    const fit = query.fit || null;
    params.fit = fit === 'contain' ? 'inside' : fit;
    params.position = query.position || null;
    return Object.entries(params)
        .filter(([, value]) => value !== null)
        .map(([key, value]) => `${key}_${value}`)
        .join(',');
};
export const initializeProxy = async function ({ config, settings, }) {
    const remoteDomains = await parseRemoteImageDomains({ config });
    const devServerUrl = getProxyUrl(settings);
    const ipx = createIPX({
        storage: ipxFSStorage({ dir: config?.build?.publish ?? './public' }),
        httpStorage: ipxHttpStorage({ domains: [...remoteDomains, devServerUrl] }),
    });
    const handler = createIPXNodeServer(ipx);
    const app = express();
    app.use(IMAGE_URL_PATTERN, async (req, res) => {
        const { url, ...query } = req.query;
        const sourceImagePath = url;
        const modifiers = (await transformImageParams(query)) || `_`;
        if (!sourceImagePath.startsWith('http://') && !sourceImagePath.startsWith('https://')) {
            // Construct the full URL for relative paths to request from development server
            const sourceImagePathWithLeadingSlash = sourceImagePath.startsWith('/') ? sourceImagePath : `/${sourceImagePath}`;
            const fullImageUrl = `${devServerUrl}${encodeURIComponent(sourceImagePathWithLeadingSlash)}`;
            console.log(`fullImageUrl: ${fullImageUrl}`);
            req.url = `/${modifiers}/${fullImageUrl}`;
        }
        else {
            // If the image is remote, we can just pass the URL as is
            req.url = `/${modifiers}/${encodeURIComponent(sourceImagePath)}`;
        }
        handler(req, res);
    });
    return app;
};
