import express from 'express';
import { createIPX, ipxFSStorage, ipxHttpStorage, createIPXNodeServer } from 'ipx';
import { log, NETLIFYDEVERR } from '../../utils/command-helpers.js';
import { getProxyUrl } from '../../utils/proxy.js';
export const IMAGE_URL_PATTERN = '/.netlify/images';
export const parseAllRemoteImages = function (config) {
    const remotePatterns = [];
    const errors = [];
    const remoteImages = config?.images?.remote_images;
    if (!remoteImages) {
        return { errors, remotePatterns };
    }
    for (const patternString of remoteImages) {
        try {
            const urlRegex = new RegExp(patternString);
            remotePatterns.push(urlRegex);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred';
            errors.push({ message });
        }
    }
    return { errors, remotePatterns };
};
const getErrorMessage = function ({ message }) {
    return message;
};
const handleRemoteImagesErrors = function (errors) {
    if (errors.length === 0) {
        return;
    }
    const errorMessage = errors.map(getErrorMessage).join('\n\n');
    log(NETLIFYDEVERR, `Remote images syntax errors:\n${errorMessage}`);
};
const parseRemoteImages = function ({ config }) {
    if (!config) {
        return [];
    }
    const { errors, remotePatterns } = parseAllRemoteImages(config);
    handleRemoteImagesErrors(errors);
    return remotePatterns;
};
export const isImageRequest = function (req) {
    return req.url?.startsWith(IMAGE_URL_PATTERN) ?? false;
};
export const transformImageParams = function (query) {
    const params = {};
    const width = query.w || query.width || null;
    const height = query.h || query.height || null;
    if (width && height) {
        params.s = `${width}x${height}`;
    }
    else {
        params.w = width;
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
export const initializeProxy = function ({ config, settings, }) {
    const remoteImages = parseRemoteImages({ config });
    const devServerUrl = getProxyUrl(settings);
    const ipx = createIPX({
        storage: ipxFSStorage({ dir: ('publish' in config.build ? config.build.publish : undefined) ?? './public' }),
        httpStorage: ipxHttpStorage({
            allowAllDomains: true,
        }),
    });
    const handler = createIPXNodeServer(ipx);
    const app = express();
    let lastTimeRemoteImagesConfigurationDetailsMessageWasLogged = 0;
    app.use(IMAGE_URL_PATTERN, (req, res) => {
        const { url, ...query } = req.query;
        const sourceImagePath = url;
        const modifiers = transformImageParams(query) || `_`;
        if (!sourceImagePath.startsWith('http://') && !sourceImagePath.startsWith('https://')) {
            // Construct the full URL for relative paths to request from development server
            const sourceImagePathWithLeadingSlash = sourceImagePath.startsWith('/') ? sourceImagePath : `/${sourceImagePath}`;
            const fullImageUrl = `${devServerUrl}${encodeURIComponent(sourceImagePathWithLeadingSlash)}`;
            req.url = `/${modifiers}/${fullImageUrl}`;
        }
        else {
            // If the image is remote, we first check if it's allowed by any of patterns
            if (!remoteImages.some((remoteImage) => remoteImage.test(sourceImagePath))) {
                const remoteImageNotAllowedLogMessage = `Remote image "${sourceImagePath}" source for Image CDN is not allowed.`;
                // Contextual information about the remote image configuration is throttled
                // to avoid spamming the console as it's quite verbose
                // Each not allowed remote image will still be logged, just without configuration details
                if (Date.now() - lastTimeRemoteImagesConfigurationDetailsMessageWasLogged > 1000 * 30) {
                    log(`${remoteImageNotAllowedLogMessage}\n\n${remoteImages.length === 0
                        ? 'Currently no remote images are allowed.'
                        : `Currently allowed remote images configuration details:\n${remoteImages
                            .map((pattern) => ` - ${pattern}`)
                            .join('\n')}`}\n\nRefer to https://ntl.fyi/remote-images for information about how to configure allowed remote images.`);
                    lastTimeRemoteImagesConfigurationDetailsMessageWasLogged = Date.now();
                }
                else {
                    log(remoteImageNotAllowedLogMessage);
                }
                res.status(400).end();
                return;
            }
            // Construct the full URL for remote paths
            req.url = `/${modifiers}/${encodeURIComponent(sourceImagePath)}`;
        }
        handler(req, res);
    });
    return app;
};
//# sourceMappingURL=proxy.js.map