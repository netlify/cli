import { Buffer } from 'buffer';
import { once } from 'events';
import { readFile } from 'fs/promises';
import http from 'http';
import https from 'https';
import { isIPv6 } from 'net';
import { Socket } from 'node:net';
import { Readable } from 'node:stream';
import path from 'path';
import process from 'process';
import url from 'url';
import util from 'util';
import zlib from 'zlib';
import contentType from 'content-type';
import cookie from 'cookie';
import { getProperty } from 'dot-prop';
import generateETag from 'etag';
import getAvailablePort from 'get-port';
import httpProxy from 'http-proxy';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { jwtDecode } from 'jwt-decode';
import { locatePath } from 'locate-path';
import throttle from 'lodash/throttle.js';
import pFilter from 'p-filter';
import { handleProxyRequest, initializeProxy as initializeEdgeFunctionsProxy, isEdgeFunctionsRequest, } from '../lib/edge-functions/proxy.js';
import { fileExistsAsync, isFileAsync } from '../lib/fs.js';
import { getFormHandler } from '../lib/functions/form-submissions-handler.js';
import { DEFAULT_FUNCTION_URL_EXPRESSION } from '../lib/functions/registry.js';
import { initializeProxy as initializeImageProxy, isImageRequest } from '../lib/images/proxy.js';
import renderErrorTemplate from '../lib/render-error-template.js';
import { NETLIFYDEVLOG, NETLIFYDEVWARN, chalk, log } from './command-helpers.js';
import createStreamPromise from './create-stream-promise.js';
import { NFFunctionName, NFFunctionRoute, NFRequestID, headersForPath, parseHeaders } from './headers.js';
import { generateRequestID } from './request-id.js';
import { createRewriter, onChanges } from './rules-proxy.js';
import { signRedirect } from './sign-redirect.js';
const gunzip = util.promisify(zlib.gunzip);
const gzip = util.promisify(zlib.gzip);
const brotliDecompress = util.promisify(zlib.brotliDecompress);
const brotliCompress = util.promisify(zlib.brotliCompress);
const deflate = util.promisify(zlib.deflate);
const inflate = util.promisify(zlib.inflate);
const shouldGenerateETag = Symbol('Internal: response should generate ETag');
const decompressResponseBody = async function (body, contentEncoding = '') {
    switch (contentEncoding) {
        case 'gzip':
            return await gunzip(body);
        case 'br':
            return await brotliDecompress(body);
        case 'deflate':
            return await inflate(body);
        default:
            return body;
    }
};
const compressResponseBody = async function (body, contentEncoding = '') {
    switch (contentEncoding) {
        case 'gzip':
            return await gzip(body);
        case 'br':
            return await brotliCompress(body);
        case 'deflate':
            return await deflate(body);
        default:
            return Buffer.from(body, 'utf8');
    }
};
const injectHtml = async function (responseBody, proxyRes, htmlInjections) {
    const decompressedBody = await decompressResponseBody(responseBody, proxyRes.headers['content-encoding']);
    const bodyWithInjections = (htmlInjections ?? []).reduce((accum, htmlInjection) => {
        if (!htmlInjection.html || typeof htmlInjection.html !== 'string') {
            return accum;
        }
        const location = htmlInjection.location ?? 'before_closing_head_tag';
        if (location === 'before_closing_head_tag') {
            accum = accum.replace('</head>', `${htmlInjection.html}</head>`);
        }
        else if (location === 'before_closing_body_tag') {
            accum = accum.replace('</body>', `${htmlInjection.html}</body>`);
        }
        return accum;
    }, decompressedBody.toString());
    return await compressResponseBody(bodyWithInjections, proxyRes.headers['content-encoding']);
};
const formatEdgeFunctionError = (errorBuffer, acceptsHtml) => {
    const { error: { message, name, stack }, } = JSON.parse(errorBuffer.toString());
    if (!acceptsHtml) {
        return `${name}: ${message}\n ${stack}`;
    }
    return JSON.stringify({
        errorType: name,
        errorMessage: message,
        trace: stack.split('\\n'),
    });
};
function isInternal(url) {
    return url?.startsWith('/.netlify/') ?? false;
}
function isFunction(functionsPort, url) {
    return functionsPort && url.match(DEFAULT_FUNCTION_URL_EXPRESSION);
}
function getAddonUrl(addonsUrls, req) {
    const matches = req.url?.match(/^\/.netlify\/([^/]+)(\/.*)/);
    const addonUrl = matches && addonsUrls[matches[1]];
    return addonUrl ? `${addonUrl}${matches[2]}` : null;
}
const getStatic = async function (pathname, publicFolder) {
    const alternatives = [pathname, ...alternativePathsFor(pathname)].map((filePath) => path.resolve(publicFolder, filePath.slice(1)));
    const file = await locatePath(alternatives);
    if (file === undefined) {
        return false;
    }
    return `/${path.relative(publicFolder, file)}`;
};
const isEndpointExists = async function (endpoint, origin) {
    const url = new URL(endpoint, origin);
    try {
        const res = await fetch(url, { method: 'HEAD' });
        return res.status !== 404;
    }
    catch (e) {
        return false;
    }
};
const isExternal = function (match) {
    return 'to' in match && /^https?:\/\//.exec(match.to) != null;
};
const stripOrigin = function ({ hash, pathname, search }) {
    return `${pathname}${search}${hash}`;
};
const proxyToExternalUrl = function ({ dest, destURL, req, res, }) {
    const handler = createProxyMiddleware({
        target: dest.origin,
        changeOrigin: true,
        pathRewrite: () => destURL,
        // hide logging
        logLevel: 'warn',
        ...(Buffer.isBuffer(req.originalBody) && { buffer: Readable.from(req.originalBody) }),
    });
    // @ts-expect-error TS(2345) FIXME: Argument of type 'Request' is not assignable to parameter of type 'Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>'.
    handler(req, res, () => { });
};
// @ts-expect-error TS(7031) FIXME: Binding element 'addonUrl' implicitly has an 'any'... Remove this comment to see the full error message
const handleAddonUrl = function ({ addonUrl, req, res }) {
    const dest = new URL(addonUrl);
    const destURL = stripOrigin(dest);
    proxyToExternalUrl({ req, res, dest, destURL });
};
const isRedirect = function (match) {
    return 'status' in match && match.status != null && match.status >= 300 && match.status <= 400;
};
const render404 = async function (publicFolder) {
    const maybe404Page = path.resolve(publicFolder, '404.html');
    try {
        const isFile = await isFileAsync(maybe404Page);
        if (isFile)
            return await readFile(maybe404Page, 'utf-8');
    }
    catch (error) {
        console.warn(NETLIFYDEVWARN, 'Error while serving 404.html file', error instanceof Error ? error.message : error?.toString());
    }
    return 'Not Found';
};
// Used as an optimization to avoid dual lookups for missing assets
const assetExtensionRegExp = /\.(html?|png|jpg|js|css|svg|gif|ico|woff|woff2)$/;
// @ts-expect-error TS(7006) FIXME: Parameter 'url' implicitly has an 'any' type.
const alternativePathsFor = function (url) {
    if (isFunction(true, url)) {
        return [];
    }
    const paths = [];
    if (url[url.length - 1] === '/') {
        const end = url.length - 1;
        if (url !== '/') {
            paths.push(`${url.slice(0, end)}.html`, `${url.slice(0, end)}.htm`);
        }
        paths.push(`${url}index.html`, `${url}index.htm`);
    }
    else if (!assetExtensionRegExp.test(url)) {
        paths.push(`${url}.html`, `${url}.htm`, `${url}/index.html`, `${url}/index.htm`);
    }
    return paths;
};
const notifyActivity = throttle((api, siteId, devServerId) => {
    // @ts-expect-error(serhalp) -- It looks like the generated API types don't include "internal" methods
    // (https://github.com/netlify/open-api/blob/66813d46e47f207443b7aebce2c22c4a4c8ca867/swagger.yml#L2642). Fix?
    api.markDevServerActivity({ siteId, devServerId }).catch((error) => {
        console.error(`${NETLIFYDEVWARN} Failed to notify activity`, error);
    });
}, 30 * 1000);
const serveRedirect = async function ({ env, functionsRegistry, imageProxy, match, options, proxy, req, res, siteInfo, }) {
    if (!match)
        return proxy.web(req, res, options);
    options = options || req.proxyOptions || {};
    options.match = null;
    if (match.force404) {
        res.writeHead(404);
        res.end(await render404(options.publicFolder));
        return;
    }
    if (match.proxyHeaders && Object.keys(match.proxyHeaders).length >= 0) {
        Object.entries(match.proxyHeaders).forEach(([key, value]) => {
            req.headers[key] = value;
        });
    }
    if (match.signingSecret) {
        const signingSecretVar = env[match.signingSecret];
        if (signingSecretVar) {
            req.headers['x-nf-sign'] = signRedirect({
                deployContext: 'dev',
                secret: signingSecretVar.value,
                siteID: siteInfo.id,
                siteURL: siteInfo.url,
            });
        }
        else {
            log(NETLIFYDEVWARN, `Could not sign redirect because environment variable ${chalk.yellow(match.signingSecret)} is not set`);
        }
    }
    if (isFunction(options.functionsPort, req.url)) {
        return proxy.web(req, res, { target: options.functionsServer });
    }
    const urlForAddons = getAddonUrl(options.addonsUrls, req);
    if (urlForAddons) {
        handleAddonUrl({ req, res, addonUrl: urlForAddons });
        return;
    }
    const originalURL = req.url;
    if (match.exceptions && match.exceptions.JWT) {
        // Some values of JWT can start with :, so, make sure to normalize them
        const expectedRoles = new Set(match.exceptions.JWT.split(',').map((value) => (value.startsWith(':') ? value.slice(1) : value)));
        const cookieValues = cookie.parse(req.headers.cookie || '');
        const token = cookieValues.nf_jwt;
        // Serve not found by default
        req.url = '/.netlify/non-existent-path';
        if (token) {
            let jwtValue = {};
            try {
                jwtValue = jwtDecode(token) || {};
            }
            catch (error) {
                // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
                console.warn(NETLIFYDEVWARN, 'Error while decoding JWT provided in request', error.message);
                res.writeHead(400);
                res.end('Invalid JWT provided. Please see logs for more info.');
                return;
            }
            // @ts-expect-error TS(2339) FIXME: Property 'exp' does not exist on type '{}'.
            if ((jwtValue.exp || 0) < Math.round(Date.now() / MILLISEC_TO_SEC)) {
                console.warn(NETLIFYDEVWARN, 'Expired JWT provided in request', req.url);
            }
            else {
                const presentedRoles = getProperty(jwtValue, options.jwtRolePath) || [];
                if (!Array.isArray(presentedRoles)) {
                    console.warn(NETLIFYDEVWARN, `Invalid roles value provided in JWT ${options.jwtRolePath}`, presentedRoles);
                    res.writeHead(400);
                    res.end('Invalid JWT provided. Please see logs for more info.');
                    return;
                }
                // Restore the URL if everything is correct
                if (presentedRoles.some((pr) => expectedRoles.has(pr))) {
                    req.url = originalURL;
                }
            }
        }
    }
    const reqUrl = reqToURL(req, req.url);
    const isHiddenProxy = match.proxyHeaders &&
        Object.entries(match.proxyHeaders).some(([key, val]) => key.toLowerCase() === 'x-nf-hidden-proxy' && val === 'true');
    const staticFile = await getStatic(decodeURIComponent(reqUrl.pathname), options.publicFolder);
    const endpointExists = !staticFile &&
        !isHiddenProxy &&
        process.env.NETLIFY_DEV_SERVER_CHECK_SSG_ENDPOINTS &&
        (await isEndpointExists(decodeURIComponent(reqUrl.pathname), options.target));
    if (staticFile || endpointExists) {
        const pathname = staticFile || reqUrl.pathname;
        req.url = encodeURI(decodeURI(pathname)) + reqUrl.search;
        // if there is an existing static file and it is not a forced redirect, return the file
        if (!match.force) {
            return proxy.web(req, res, { ...options, staticFile });
        }
    }
    if (match.force || !staticFile || !options.framework || req.method === 'POST') {
        // construct destination URL from redirect rule match
        const dest = new URL(match.to, `${reqUrl.protocol}//${reqUrl.host}`);
        // We pass through request params if the redirect rule
        // doesn't have any query params
        if ([...dest.searchParams].length === 0) {
            dest.searchParams.forEach((_, key) => {
                dest.searchParams.delete(key);
            });
            const requestParams = new URLSearchParams(reqUrl.searchParams);
            requestParams.forEach((val, key) => {
                dest.searchParams.append(key, val);
            });
        }
        let destURL = stripOrigin(dest);
        if (isExternal(match)) {
            if (isRedirect(match)) {
                // This is a redirect, so we set the complete external URL as destination
                destURL = `${dest}`;
            }
            else {
                if (!isHiddenProxy) {
                    console.log(`${NETLIFYDEVLOG} Proxying to ${dest}`);
                }
                proxyToExternalUrl({ req, res, dest, destURL });
                return;
            }
        }
        if (isRedirect(match)) {
            console.log(`${NETLIFYDEVLOG} Redirecting ${req.url} to ${destURL}`);
            res.writeHead(match.status, {
                Location: destURL,
                'Cache-Control': 'no-cache',
            });
            res.end(`Redirecting to ${destURL}`);
            return;
        }
        const ct = req.headers['content-type'] ? contentType.parse(req).type : '';
        if (req.method === 'POST' &&
            !isInternal(req.url) &&
            !isInternal(destURL) &&
            (ct.endsWith('/x-www-form-urlencoded') || ct === 'multipart/form-data')) {
            return proxy.web(req, res, { target: options.functionsServer });
        }
        const destStaticFile = await getStatic(dest.pathname, options.publicFolder);
        const matchingFunction = functionsRegistry &&
            (await functionsRegistry.getFunctionForURLPath(destURL, req.method, () => Boolean(destStaticFile)));
        let statusValue;
        if (match.force ||
            (!staticFile && ((!options.framework && destStaticFile) || isInternal(destURL) || matchingFunction))) {
            req.url = destStaticFile ? destStaticFile + dest.search : destURL;
            const { status } = match;
            statusValue = status;
            console.log(`${NETLIFYDEVLOG} Rewrote URL to`, req.url);
        }
        if (matchingFunction) {
            const functionHeaders = matchingFunction.func
                ? {
                    [NFFunctionName]: matchingFunction.func?.name,
                    [NFFunctionRoute]: matchingFunction.route,
                }
                : {};
            const url = reqToURL(req, originalURL);
            req.headers['x-netlify-original-pathname'] = url.pathname;
            req.headers['x-netlify-original-search'] = url.search;
            return proxy.web(req, res, { headers: functionHeaders, target: options.functionsServer });
        }
        if (isImageRequest(req)) {
            return imageProxy(req, res);
        }
        const addonUrl = getAddonUrl(options.addonsUrls, req);
        if (addonUrl) {
            handleAddonUrl({ req, res, addonUrl });
            return;
        }
        return proxy.web(req, res, { ...options, status: statusValue });
    }
    return proxy.web(req, res, options);
};
// @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
const reqToURL = function (req, pathname) {
    return new URL(pathname, `${req.protocol || (req.headers.scheme && `${req.headers.scheme}:`) || 'http:'}//${req.headers.host || req.hostname}`);
};
const MILLISEC_TO_SEC = 1e3;
const initializeProxy = async function ({ config, configPath, distDir, env, host, imageProxy, port, projectDir, siteInfo, }) {
    const proxy = httpProxy.createProxyServer({
        selfHandleResponse: true,
        target: {
            host,
            port,
        },
    });
    const headersFiles = [...new Set([path.resolve(projectDir, '_headers'), path.resolve(distDir, '_headers')])];
    let headers = await parseHeaders({ headersFiles, configPath, config });
    const watchedHeadersFiles = configPath === undefined ? headersFiles : [...headersFiles, configPath];
    onChanges(watchedHeadersFiles, async () => {
        const existingHeadersFiles = await pFilter(watchedHeadersFiles, fileExistsAsync);
        console.log(`${NETLIFYDEVLOG} Reloading headers files from`, existingHeadersFiles.map((headerFile) => path.relative(projectDir, headerFile)));
        headers = await parseHeaders({ headersFiles, configPath, config });
    });
    // @ts-expect-error TS(2339) FIXME: Property 'before' does not exist on type 'Server'.
    proxy.before('web', 'stream', (req) => {
        // See https://github.com/http-party/node-http-proxy/issues/1219#issuecomment-511110375
        if (req.headers.expect) {
            req.__expectHeader = req.headers.expect;
            delete req.headers.expect;
        }
    });
    proxy.on('error', (err, req, res, proxyUrl) => {
        // @ts-expect-error TS(2339) FIXME: Property 'proxyOptions' does not exist on type 'In... Remove this comment to see the full error message
        const options = req.proxyOptions;
        const isConRefused = 'code' in err && err.code === 'ECONNREFUSED';
        if (options?.detectTarget && !(res instanceof Socket) && isConRefused && proxyUrl) {
            // got econnrefused while detectTarget set to true -> try to switch between current ipVer and other (4 to 6 and vice versa)
            // proxyUrl is parsed in http-proxy using url, parsing the same here. Difference between it and
            // URL that hostname not includes [] symbols when using url.parse
            // eslint-disable-next-line n/no-deprecated-api
            const targetUrl = typeof proxyUrl === 'string' ? url.parse(proxyUrl) : proxyUrl;
            const isCurrentHost = targetUrl.hostname === options.targetHostname;
            if (targetUrl.hostname && isCurrentHost) {
                const newHost = isIPv6(targetUrl.hostname) ? '127.0.0.1' : '::1';
                options.target = `http://${isIPv6(newHost) ? `[${newHost}]` : newHost}:${targetUrl.port}`;
                options.targetHostname = newHost;
                options.isChangingTarget = true;
                proxy.web(req, res, options);
                return;
            }
        }
        if (res instanceof http.ServerResponse) {
            res.writeHead(500, {
                'Content-Type': 'text/plain',
            });
        }
        const message = isEdgeFunctionsRequest(req)
            ? 'There was an error with an Edge Function. Please check the terminal for more details.'
            : 'Could not proxy request.';
        res.end(message);
    });
    proxy.on('proxyReq', (proxyReq, req) => {
        const requestID = generateRequestID();
        proxyReq.setHeader(NFRequestID, requestID);
        req.headers[NFRequestID] = requestID;
        if (isEdgeFunctionsRequest(req)) {
            handleProxyRequest(req, proxyReq);
        }
        // @ts-expect-error TS(2339) FIXME: Property '__expectHeader' does not exist on type '... Remove this comment to see the full error message
        if (req.__expectHeader) {
            // @ts-expect-error TS(2339) FIXME: Property '__expectHeader' does not exist on type '... Remove this comment to see the full error message
            proxyReq.setHeader('Expect', req.__expectHeader);
        }
        // @ts-expect-error TS(2339) FIXME: Property 'originalBody' does not exist on type 'In... Remove this comment to see the full error message
        if (req.originalBody) {
            // @ts-expect-error TS(2339) FIXME: Property 'originalBody' does not exist on type 'In... Remove this comment to see the full error message
            proxyReq.write(req.originalBody);
        }
    });
    proxy.on('proxyRes', (proxyRes, req, res) => {
        res.setHeader('server', 'Netlify');
        const requestID = req.headers[NFRequestID];
        if (requestID) {
            res.setHeader(NFRequestID, requestID);
        }
        // @ts-expect-error TS(2339) FIXME: Property 'proxyOptions' does not exist on type 'In... Remove this comment to see the full error message
        const options = req.proxyOptions;
        if (options.isChangingTarget) {
            // got a response after switching the ipVer for host (and its not an error since we will be in on('error') handler) - let's remember this host now
            // options are not exported in ts for the proxy:
            // @ts-expect-error TS(2339) FIXME: Property 'options' does not exist on type 'In...
            proxy.options.target.host = options.targetHostname;
            options.changeSettings?.({
                frameworkHost: options.targetHostname,
                detectFrameworkHost: false,
            });
            console.log(`${NETLIFYDEVLOG} Switched host to ${options.targetHostname}`);
        }
        if (proxyRes.statusCode === 404 || proxyRes.statusCode === 403) {
            // If a request for `/path` has failed, we'll a few variations like
            // `/path/index.html` to mimic the CDN behavior.
            // @ts-expect-error TS(2339) FIXME: Property 'alternativePaths' does not exist on type... Remove this comment to see the full error message
            if (req.alternativePaths && req.alternativePaths.length !== 0) {
                // @ts-expect-error TS(2339) FIXME: Property 'alternativePaths' does not exist on type... Remove this comment to see the full error message
                req.url = req.alternativePaths.shift();
                // @ts-expect-error TS(2339) FIXME: Property 'proxyOptions' does not exist on type 'In... Remove this comment to see the full error message
                proxy.web(req, res, req.proxyOptions);
                return;
            }
            // The request has failed but we might still have a matching redirect
            // rule (without `force`) that should kick in. This is how we mimic the
            // file shadowing behavior from the CDN.
            if (options && options.match) {
                return serveRedirect({
                    // We don't want to match functions at this point because any redirects
                    // to functions will have already been processed, so we don't supply a
                    // functions registry to `serveRedirect`.
                    functionsRegistry: null,
                    req,
                    res,
                    proxy: handlers,
                    imageProxy,
                    match: options.match,
                    options,
                    siteInfo,
                    env,
                });
            }
        }
        if (options.staticFile && isRedirect({ status: proxyRes.statusCode }) && proxyRes.headers.location) {
            req.url = proxyRes.headers.location;
            return serveRedirect({
                // We don't want to match functions at this point because any redirects
                // to functions will have already been processed, so we don't supply a
                // functions registry to `serveRedirect`.
                functionsRegistry: null,
                req,
                res,
                proxy: handlers,
                imageProxy,
                match: null,
                options,
                siteInfo,
                env,
            });
        }
        // @ts-expect-error TS(7034) FIXME: Variable 'responseData' implicitly has type 'any[]... Remove this comment to see the full error message
        const responseData = [];
        // @ts-expect-error TS(2345) FIXME: Argument of type 'string | undefined' is not assig... Remove this comment to see the full error message
        const requestURL = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
        const headersRules = headersForPath(headers, requestURL.pathname);
        const configInjections = config.dev?.processing?.html?.injections ?? [];
        const htmlInjections = configInjections.length > 0 && proxyRes.headers?.['content-type']?.startsWith('text/html')
            ? configInjections
            : undefined;
        // for streamed responses, we can't do etag generation nor error templates.
        // we'll just stream them through!
        // when html_injections are present in dev config, we can't use streamed response
        const isStreamedResponse = proxyRes.headers['content-length'] === undefined;
        if (isStreamedResponse && !htmlInjections) {
            Object.entries(headersRules).forEach(([key, val]) => {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
                res.setHeader(key, val);
            });
            res.writeHead(options.status || proxyRes.statusCode, proxyRes.headers);
            proxyRes.on('data', function onData(data) {
                res.write(data);
            });
            proxyRes.on('end', function onEnd() {
                res.end();
            });
            return;
        }
        proxyRes.on('data', function onData(data) {
            responseData.push(data);
        });
        proxyRes.on('end', async function onEnd() {
            // @ts-expect-error TS(7005) FIXME: Variable 'responseData' implicitly has an 'any[]' ... Remove this comment to see the full error message
            let responseBody = Buffer.concat(responseData);
            let responseStatus = options.status || proxyRes.statusCode;
            // `req[shouldGenerateETag]` may contain a function that determines
            // whether the response should have an ETag header.
            if (
            // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            typeof req[shouldGenerateETag] === 'function' &&
                // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                req[shouldGenerateETag]({ statusCode: responseStatus }) === true) {
                const etag = generateETag(responseBody, { weak: true });
                if (req.headers['if-none-match'] === etag) {
                    responseStatus = 304;
                }
                res.setHeader('etag', etag);
            }
            Object.entries(headersRules).forEach(([key, val]) => {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
                res.setHeader(key, val);
            });
            const isUncaughtError = proxyRes.headers['x-nf-uncaught-error'] === '1';
            if (isEdgeFunctionsRequest(req) && isUncaughtError) {
                const acceptsHtml = req.headers.accept?.includes('text/html') ?? false;
                const decompressedBody = await decompressResponseBody(responseBody, proxyRes.headers['content-encoding']);
                const formattedBody = formatEdgeFunctionError(decompressedBody, acceptsHtml);
                const errorResponse = acceptsHtml
                    ? await renderErrorTemplate(formattedBody, '../../src/lib/templates/function-error.html', 'edge function')
                    : formattedBody;
                const contentLength = Buffer.from(errorResponse, 'utf8').byteLength;
                res.setHeader('content-length', contentLength);
                res.statusCode = 500;
                res.write(errorResponse);
                return res.end();
            }
            let proxyResHeaders = proxyRes.headers;
            if (htmlInjections) {
                responseBody = await injectHtml(responseBody, proxyRes, htmlInjections);
                proxyResHeaders = {
                    ...proxyResHeaders,
                    'content-length': String(responseBody.byteLength),
                };
                delete proxyResHeaders['transfer-encoding'];
            }
            res.writeHead(responseStatus, proxyResHeaders);
            if (responseStatus !== 304) {
                res.write(responseBody);
            }
            res.end();
        });
    });
    const handlers = {
        // @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
        web: (req, res, options) => {
            const requestURL = new URL(req.url, 'http://127.0.0.1');
            req.proxyOptions = options;
            req.alternativePaths = alternativePathsFor(requestURL.pathname).map((filePath) => filePath + requestURL.search);
            // Ref: https://nodejs.org/api/net.html#net_socket_remoteaddress
            req.headers['x-forwarded-for'] = req.connection.remoteAddress || '';
            proxy.web(req, res, options);
        },
        // @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
        ws: (req, socket, head, options) => {
            proxy.ws(req, socket, head, options);
        },
    };
    return handlers;
};
const onRequest = async ({ addonsUrls, api, edgeFunctionsProxy, env, functionsRegistry, functionsServer, imageProxy, proxy, rewriter, settings, siteInfo, }, req, res) => {
    req.originalBody =
        req.method && ['GET', 'OPTIONS', 'HEAD'].includes(req.method) ? null : await createStreamPromise(req, BYTES_LIMIT);
    if (isImageRequest(req)) {
        return imageProxy(req, res);
    }
    const edgeFunctionsProxyURL = await edgeFunctionsProxy?.(req);
    if (edgeFunctionsProxyURL !== undefined) {
        return proxy.web(req, res, { target: edgeFunctionsProxyURL });
    }
    const functionMatch = functionsRegistry &&
        (await functionsRegistry.getFunctionForURLPath(req.url, req.method, () => getStatic(decodeURIComponent(reqToURL(req, req.url).pathname), settings.dist ?? '')));
    if (functionMatch) {
        // Setting an internal header with the function name so that we don't
        // have to match the URL again in the functions server.
        const headers = {};
        if (functionMatch.func) {
            headers[NFFunctionName] = functionMatch.func.name;
        }
        if (functionMatch.route) {
            headers[NFFunctionRoute] = functionMatch.route.pattern;
        }
        return proxy.web(req, res, { headers, target: functionsServer });
    }
    const addonUrl = getAddonUrl(addonsUrls, req);
    if (addonUrl) {
        handleAddonUrl({ req, res, addonUrl });
        return;
    }
    const match = await rewriter(req);
    const options = {
        match,
        addonsUrls,
        target: `http://${settings.frameworkHost && isIPv6(settings.frameworkHost) ? `[${settings.frameworkHost}]` : settings.frameworkHost}:${settings.frameworkPort}`,
        detectTarget: settings.detectFrameworkHost,
        targetHostname: settings.frameworkHost,
        publicFolder: settings.dist,
        functionsServer,
        functionsPort: settings.functionsPort,
        jwtRolePath: settings.jwtRolePath,
        framework: settings.framework,
        changeSettings(newSettings) {
            Object.assign(settings, newSettings);
        },
    };
    const maybeNotifyActivity = () => {
        if (req.method === 'GET' && api && process.env.NETLIFY_DEV_SERVER_ID) {
            notifyActivity(api, siteInfo.id, process.env.NETLIFY_DEV_SERVER_ID);
        }
    };
    if (match) {
        if (!isExternal(match)) {
            maybeNotifyActivity();
        }
        // We don't want to generate an ETag for 3xx redirects.
        // @ts-expect-error TS(7031) FIXME: Binding element 'statusCode' implicitly has an 'an... Remove this comment to see the full error message
        req[shouldGenerateETag] = ({ statusCode }) => statusCode < 300 || statusCode >= 400;
        return serveRedirect({ req, res, proxy, imageProxy, match, options, siteInfo, env, functionsRegistry });
    }
    // The request will be served by the framework server, which means we want to
    // generate an ETag unless we're rendering an error page. The only way for
    // us to know that is by looking at the status code
    // @ts-expect-error TS(7031) FIXME: Binding element 'statusCode' implicitly has an 'an... Remove this comment to see the full error message
    req[shouldGenerateETag] = ({ statusCode }) => statusCode >= 200 && statusCode < 300;
    const hasFormSubmissionHandler = functionsRegistry && getFormHandler({ functionsRegistry, logWarning: false });
    const ct = req.headers['content-type'] ? contentType.parse(req).type : '';
    if (hasFormSubmissionHandler &&
        functionsServer &&
        req.method === 'POST' &&
        !isInternal(req.url) &&
        (ct.endsWith('/x-www-form-urlencoded') || ct === 'multipart/form-data')) {
        return proxy.web(req, res, { target: functionsServer });
    }
    maybeNotifyActivity();
    proxy.web(req, res, options);
};
export const getProxyUrl = function (settings) {
    const scheme = settings.https ? 'https' : 'http';
    return `${scheme}://localhost:${settings.port}`;
};
export const startProxy = async function ({ accountId, addonsUrls, api, blobsContext, command, config, configPath, debug, disableEdgeFunctions, env, functionsRegistry, geoCountry, geolocationMode, getUpdatedConfig, inspectSettings, offline, projectDir, repositoryRoot, settings, siteInfo, state, }) {
    const secondaryServerPort = settings.https ? await getAvailablePort() : null;
    const functionsServer = settings.functionsPort ? `http://127.0.0.1:${settings.functionsPort}` : null;
    let edgeFunctionsProxy;
    if (disableEdgeFunctions) {
        log(NETLIFYDEVWARN, 'Edge functions are disabled. Run without the --internal-disable-edge-functions flag to enable them.');
    }
    else {
        edgeFunctionsProxy = await initializeEdgeFunctionsProxy({
            command,
            blobsContext,
            config,
            configPath,
            debug,
            env,
            geolocationMode,
            geoCountry,
            getUpdatedConfig,
            inspectSettings,
            mainPort: settings.port,
            offline,
            passthroughPort: secondaryServerPort || settings.port,
            settings,
            projectDir,
            repositoryRoot,
            siteInfo,
            accountId,
            state,
        });
    }
    const imageProxy = initializeImageProxy({
        config,
        settings,
    });
    const proxy = await initializeProxy({
        env,
        host: settings.frameworkHost,
        port: settings.frameworkPort,
        distDir: settings.dist,
        projectDir,
        configPath,
        siteInfo,
        imageProxy,
        config,
    });
    const rewriter = await createRewriter({
        config,
        configPath,
        distDir: settings.dist,
        geoCountry,
        jwtSecret: settings.jwtSecret,
        jwtRoleClaim: settings.jwtRolePath,
        projectDir,
    });
    const onRequestWithOptions = onRequest.bind(undefined, {
        proxy,
        rewriter,
        settings,
        addonsUrls,
        functionsRegistry,
        functionsServer,
        edgeFunctionsProxy,
        imageProxy,
        siteInfo,
        env,
        api,
    });
    const primaryServer = settings.https
        ? https.createServer({ cert: settings.https.cert, key: settings.https.key }, onRequestWithOptions)
        : http.createServer(onRequestWithOptions);
    const onUpgrade = async function onUpgrade(req, socket, head) {
        const match = await rewriter(req);
        if (match && !match.force404 && isExternal(match)) {
            const reqUrl = reqToURL(req, req.url);
            const dest = new URL(match.to, `${reqUrl.protocol}//${reqUrl.host}`);
            const destURL = stripOrigin(dest);
            proxy.ws(req, socket, head, { target: dest.origin, changeOrigin: true, pathRewrite: () => destURL });
            return;
        }
        proxy.ws(req, socket, head, {});
    };
    primaryServer.on('upgrade', onUpgrade);
    primaryServer.listen({ port: settings.port });
    const eventQueue = [once(primaryServer, 'listening')];
    // If we're running the main server on HTTPS, we need to start a secondary
    // server on HTTP for receiving passthrough requests from edge functions.
    // This lets us run the Deno server on HTTP and avoid the complications of
    // Deno talking to Node on HTTPS with potentially untrusted certificates.
    if (secondaryServerPort) {
        const secondaryServer = http.createServer(onRequestWithOptions);
        secondaryServer.on('upgrade', onUpgrade);
        secondaryServer.listen({ port: secondaryServerPort });
        eventQueue.push(once(secondaryServer, 'listening'));
    }
    await Promise.all(eventQueue);
    return getProxyUrl(settings);
};
const BYTES_LIMIT = 30;
//# sourceMappingURL=proxy.js.map