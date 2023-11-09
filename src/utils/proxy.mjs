import { Buffer } from 'buffer';
import { once } from 'events';
import { readFile } from 'fs/promises';
import http from 'http';
import https from 'https';
import { isIPv6 } from 'net';
import path from 'path';
import util from 'util';
import zlib from 'zlib';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'cont... Remove this comment to see the full error message
import contentType from 'content-type';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'cook... Remove this comment to see the full error message
import cookie from 'cookie';
import { getProperty } from 'dot-prop';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'etag... Remove this comment to see the full error message
import generateETag from 'etag';
import getAvailablePort from 'get-port';
import httpProxy from 'http-proxy';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwtDecode from 'jwt-decode';
import { locatePath } from 'locate-path';
import pFilter from 'p-filter';
import toReadableStream from 'to-readable-stream';
import { handleProxyRequest, initializeProxy as initializeEdgeFunctionsProxy, isEdgeFunctionsRequest, } from '../lib/edge-functions/proxy.mjs';
import { fileExistsAsync, isFileAsync } from '../lib/fs.mjs';
import { DEFAULT_FUNCTION_URL_EXPRESSION } from '../lib/functions/registry.mjs';
import { initializeProxy as initializeImageProxy, isImageRequest } from '../lib/images/proxy.mjs';
import renderErrorTemplate from '../lib/render-error-template.mjs';
import { NETLIFYDEVLOG, NETLIFYDEVWARN, log, chalk } from './command-helpers.mjs';
import createStreamPromise from './create-stream-promise.mjs';
import { headersForPath, parseHeaders, NFFunctionName, NFRequestID, NFFunctionRoute } from './headers.mjs';
import { generateRequestID } from './request-id.mjs';
import { createRewriter, onChanges } from './rules-proxy.mjs';
import { signRedirect } from './sign-redirect.mjs';
const gunzip = util.promisify(zlib.gunzip);
const brotliDecompress = util.promisify(zlib.brotliDecompress);
const deflate = util.promisify(zlib.deflate);
const shouldGenerateETag = Symbol('Internal: response should generate ETag');
/**
 * @param {Buffer} body
 * @param {string | undefined} contentEncoding
 * @returns {Promise<Buffer>}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'body' implicitly has an 'any' type.
const decompressResponseBody = async function (body, contentEncoding = '') {
    switch (contentEncoding) {
        case 'gzip':
            return await gunzip(body);
        case 'br':
            return await brotliDecompress(body);
        case 'deflate':
            return await deflate(body);
        default:
            return body;
    }
};
// @ts-expect-error TS(7006) FIXME: Parameter 'errorBuffer' implicitly has an 'any' ty... Remove this comment to see the full error message
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
/**
 * @param {string} url
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'url' implicitly has an 'any' type.
function isInternal(url) {
    return url.startsWith('/.netlify/');
}
/**
 * @param {boolean|number|undefined} functionsPort
 * @param {string} url
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'functionsPort' implicitly has an 'any' ... Remove this comment to see the full error message
function isFunction(functionsPort, url) {
    return functionsPort && url.match(DEFAULT_FUNCTION_URL_EXPRESSION);
}
/**
 * @param {Record<string, string>} addonsUrls
 * @param {http.IncomingMessage} req
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'addonsUrls' implicitly has an 'any' typ... Remove this comment to see the full error message
function getAddonUrl(addonsUrls, req) {
    const matches = req.url?.match(/^\/.netlify\/([^/]+)(\/.*)/);
    const addonUrl = matches && addonsUrls[matches[1]];
    return addonUrl ? `${addonUrl}${matches[2]}` : null;
}
/**
 * @param {string} pathname
 * @param {string} publicFolder
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'pathname' implicitly has an 'any' type.
const getStatic = async function (pathname, publicFolder) {
    const alternatives = [pathname, ...alternativePathsFor(pathname)].map((filePath) => path.resolve(publicFolder, filePath.slice(1)));
    const file = await locatePath(alternatives);
    if (file === undefined) {
        return false;
    }
    return `/${path.relative(publicFolder, file)}`;
};
// @ts-expect-error TS(7006) FIXME: Parameter 'match' implicitly has an 'any' type.
const isExternal = function (match) {
    return match.to && match.to.match(/^https?:\/\//);
};
// @ts-expect-error TS(7031) FIXME: Binding element 'hash' implicitly has an 'any' typ... Remove this comment to see the full error message
const stripOrigin = function ({ hash, pathname, search }) {
    return `${pathname}${search}${hash}`;
};
// @ts-expect-error TS(7031) FIXME: Binding element 'dest' implicitly has an 'any' typ... Remove this comment to see the full error message
const proxyToExternalUrl = function ({ dest, destURL, req, res }) {
    console.log(`${NETLIFYDEVLOG} Proxying to ${dest}`);
    const handler = createProxyMiddleware({
        target: dest.origin,
        changeOrigin: true,
        pathRewrite: () => destURL,
        ...(Buffer.isBuffer(req.originalBody) && { buffer: toReadableStream(req.originalBody) }),
    });
    return handler(req, res, () => { });
};
// @ts-expect-error TS(7031) FIXME: Binding element 'addonUrl' implicitly has an 'any'... Remove this comment to see the full error message
const handleAddonUrl = function ({ addonUrl, req, res }) {
    const dest = new URL(addonUrl);
    const destURL = stripOrigin(dest);
    return proxyToExternalUrl({ req, res, dest, destURL });
};
// @ts-expect-error TS(7006) FIXME: Parameter 'match' implicitly has an 'any' type.
const isRedirect = function (match) {
    return match.status && match.status >= 300 && match.status <= 400;
};
// @ts-expect-error TS(7006) FIXME: Parameter 'publicFolder' implicitly has an 'any' t... Remove this comment to see the full error message
const render404 = async function (publicFolder) {
    const maybe404Page = path.resolve(publicFolder, '404.html');
    try {
        const isFile = await isFileAsync(maybe404Page);
        if (isFile)
            return await readFile(maybe404Page, 'utf-8');
    }
    catch (error) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        console.warn(NETLIFYDEVWARN, 'Error while serving 404.html file', error.message);
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
const serveRedirect = async function ({ 
// @ts-expect-error TS(7031) FIXME: Binding element 'env' implicitly has an 'any' type... Remove this comment to see the full error message
env, 
// @ts-expect-error TS(7031) FIXME: Binding element 'functionsRegistry' implicitly has... Remove this comment to see the full error message
functionsRegistry, 
// @ts-expect-error TS(7031) FIXME: Binding element 'imageProxy' implicitly has an 'an... Remove this comment to see the full error message
imageProxy, 
// @ts-expect-error TS(7031) FIXME: Binding element 'match' implicitly has an 'any' ty... Remove this comment to see the full error message
match, 
// @ts-expect-error TS(7031) FIXME: Binding element 'options' implicitly has an 'any' ... Remove this comment to see the full error message
options, 
// @ts-expect-error TS(7031) FIXME: Binding element 'proxy' implicitly has an 'any' ty... Remove this comment to see the full error message
proxy, 
// @ts-expect-error TS(7031) FIXME: Binding element 'req' implicitly has an 'any' type... Remove this comment to see the full error message
req, 
// @ts-expect-error TS(7031) FIXME: Binding element 'res' implicitly has an 'any' type... Remove this comment to see the full error message
res, 
// @ts-expect-error TS(7031) FIXME: Binding element 'siteInfo' implicitly has an 'any'... Remove this comment to see the full error message
siteInfo, }) {
    if (!match)
        return proxy.web(req, res, options);
    options = options || req.proxyOptions || {};
    options.match = null;
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
        return handleAddonUrl({ req, res, addonUrl: urlForAddons });
    }
    const originalURL = req.url;
    if (match.exceptions && match.exceptions.JWT) {
        // Some values of JWT can start with :, so, make sure to normalize them
        const expectedRoles = new Set(
        // @ts-expect-error TS(7006) FIXME: Parameter 'value' implicitly has an 'any' type.
        match.exceptions.JWT.split(',').map((value) => (value.startsWith(':') ? value.slice(1) : value)));
        const cookieValues = cookie.parse(req.headers.cookie || '');
        const token = cookieValues.nf_jwt;
        // Serve not found by default
        req.url = '/.netlify/non-existent-path';
        if (token) {
            let jwtValue = {};
            try {
                // @ts-expect-error TS(2349) This expression is not callable
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
    const staticFile = await getStatic(decodeURIComponent(reqUrl.pathname), options.publicFolder);
    if (staticFile) {
        req.url = encodeURI(staticFile) + reqUrl.search;
        // if there is an existing static file and it is not a forced redirect, return the file
        if (!match.force) {
            return proxy.web(req, res, { ...options, staticFile });
        }
    }
    if (match.force404) {
        res.writeHead(404);
        res.end(await render404(options.publicFolder));
        return;
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
                return proxyToExternalUrl({ req, res, dest, destURL });
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
        const matchingFunction = functionsRegistry && (await functionsRegistry.getFunctionForURLPath(destURL, req.method));
        const destStaticFile = await getStatic(dest.pathname, options.publicFolder);
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
            return handleAddonUrl({ req, res, addonUrl });
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
// @ts-expect-error TS(7031) FIXME: Binding element 'configPath' implicitly has an 'an... Remove this comment to see the full error message
const initializeProxy = async function ({ configPath, distDir, env, host, imageProxy, port, projectDir, siteInfo }) {
    const proxy = httpProxy.createProxyServer({
        selfHandleResponse: true,
        target: {
            host,
            port,
        },
    });
    const headersFiles = [...new Set([path.resolve(projectDir, '_headers'), path.resolve(distDir, '_headers')])];
    let headers = await parseHeaders({ headersFiles, configPath });
    const watchedHeadersFiles = configPath === undefined ? headersFiles : [...headersFiles, configPath];
    onChanges(watchedHeadersFiles, async () => {
        const existingHeadersFiles = await pFilter(watchedHeadersFiles, fileExistsAsync);
        console.log(`${NETLIFYDEVLOG} Reloading headers files from`, existingHeadersFiles.map((headerFile) => path.relative(projectDir, headerFile)));
        headers = await parseHeaders({ headersFiles, configPath });
    });
    // @ts-expect-error TS(2339) FIXME: Property 'before' does not exist on type 'Server'.
    proxy.before('web', 'stream', (req) => {
        // See https://github.com/http-party/node-http-proxy/issues/1219#issuecomment-511110375
        if (req.headers.expect) {
            req.__expectHeader = req.headers.expect;
            delete req.headers.expect;
        }
    });
    proxy.on('error', (_, req, res) => {
        // @ts-expect-error TS(2339) FIXME: Property 'writeHead' does not exist on type 'Socke... Remove this comment to see the full error message
        res.writeHead(500, {
            'Content-Type': 'text/plain',
        });
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
        if (proxyRes.statusCode === 404 || proxyRes.statusCode === 403) {
            // If a request for `/path` has failed, we'll a few variations like
            // `/path/index.html` to mimic the CDN behavior.
            // @ts-expect-error TS(2339) FIXME: Property 'alternativePaths' does not exist on type... Remove this comment to see the full error message
            if (req.alternativePaths && req.alternativePaths.length !== 0) {
                // @ts-expect-error TS(2339) FIXME: Property 'alternativePaths' does not exist on type... Remove this comment to see the full error message
                req.url = req.alternativePaths.shift();
                // @ts-expect-error TS(2339) FIXME: Property 'proxyOptions' does not exist on type 'In... Remove this comment to see the full error message
                return proxy.web(req, res, req.proxyOptions);
            }
            // The request has failed but we might still have a matching redirect
            // rule (without `force`) that should kick in. This is how we mimic the
            // file shadowing behavior from the CDN.
            // @ts-expect-error TS(2339) FIXME: Property 'proxyOptions' does not exist on type 'In... Remove this comment to see the full error message
            if (req.proxyOptions && req.proxyOptions.match) {
                return serveRedirect({
                    // We don't want to match functions at this point because any redirects
                    // to functions will have already been processed, so we don't supply a
                    // functions registry to `serveRedirect`.
                    functionsRegistry: null,
                    req,
                    res,
                    proxy: handlers,
                    imageProxy,
                    // @ts-expect-error TS(2339) FIXME: Property 'proxyOptions' does not exist on type 'In... Remove this comment to see the full error message
                    match: req.proxyOptions.match,
                    // @ts-expect-error TS(2339) FIXME: Property 'proxyOptions' does not exist on type 'In... Remove this comment to see the full error message
                    options: req.proxyOptions,
                    siteInfo,
                    env,
                });
            }
        }
        // @ts-expect-error TS(2339) FIXME: Property 'proxyOptions' does not exist on type 'In... Remove this comment to see the full error message
        if (req.proxyOptions.staticFile && isRedirect({ status: proxyRes.statusCode }) && proxyRes.headers.location) {
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
                // @ts-expect-error TS(2339) FIXME: Property 'proxyOptions' does not exist on type 'In... Remove this comment to see the full error message
                options: req.proxyOptions,
                siteInfo,
                env,
            });
        }
        // @ts-expect-error TS(7034) FIXME: Variable 'responseData' implicitly has type 'any[]... Remove this comment to see the full error message
        const responseData = [];
        // @ts-expect-error TS(2345) FIXME: Argument of type 'string | undefined' is not assig... Remove this comment to see the full error message
        const requestURL = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
        const headersRules = headersForPath(headers, requestURL.pathname);
        // for streamed responses, we can't do etag generation nor error templates.
        // we'll just stream them through!
        const isStreamedResponse = proxyRes.headers['content-length'] === undefined;
        if (isStreamedResponse) {
            Object.entries(headersRules).forEach(([key, val]) => {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
                res.setHeader(key, val);
            });
            // @ts-expect-error TS(2339) FIXME: Property 'proxyOptions' does not exist on type 'In... Remove this comment to see the full error message
            res.writeHead(req.proxyOptions.status || proxyRes.statusCode, proxyRes.headers);
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
            const responseBody = Buffer.concat(responseData);
            // @ts-expect-error TS(2339) FIXME: Property 'proxyOptions' does not exist on type 'In... Remove this comment to see the full error message
            let responseStatus = req.proxyOptions.status || proxyRes.statusCode;
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
                const acceptsHtml = req.headers && req.headers.accept && req.headers.accept.includes('text/html');
                const decompressedBody = await decompressResponseBody(responseBody, proxyRes.headers['content-encoding']);
                const formattedBody = formatEdgeFunctionError(decompressedBody, acceptsHtml);
                const errorResponse = acceptsHtml
                    ? await renderErrorTemplate(formattedBody, './templates/function-error.html', 'edge function')
                    : formattedBody;
                const contentLength = Buffer.from(errorResponse, 'utf8').byteLength;
                res.setHeader('content-length', contentLength);
                res.statusCode = 500;
                res.write(errorResponse);
                return res.end();
            }
            res.writeHead(responseStatus, proxyRes.headers);
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
            return proxy.web(req, res, options);
        },
        // @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
        ws: (req, socket, head) => proxy.ws(req, socket, head),
    };
    return handlers;
};
const onRequest = async ({ 
// @ts-expect-error TS(7031) FIXME: Binding element 'addonsUrls' implicitly has an 'an... Remove this comment to see the full error message
addonsUrls, 
// @ts-expect-error TS(7031) FIXME: Binding element 'edgeFunctionsProxy' implicitly ha... Remove this comment to see the full error message
edgeFunctionsProxy, 
// @ts-expect-error TS(7031) FIXME: Binding element 'env' implicitly has an 'any' type... Remove this comment to see the full error message
env, 
// @ts-expect-error TS(7031) FIXME: Binding element 'functionsRegistry' implicitly has... Remove this comment to see the full error message
functionsRegistry, 
// @ts-expect-error TS(7031) FIXME: Binding element 'functionsServer' implicitly has a... Remove this comment to see the full error message
functionsServer, 
// @ts-expect-error TS(7031) FIXME: Binding element 'imageProxy' implicitly has an 'an... Remove this comment to see the full error message
imageProxy, 
// @ts-expect-error TS(7031) FIXME: Binding element 'proxy' implicitly has an 'any' ty... Remove this comment to see the full error message
proxy, 
// @ts-expect-error TS(7031) FIXME: Binding element 'rewriter' implicitly has an 'any'... Remove this comment to see the full error message
rewriter, 
// @ts-expect-error TS(7031) FIXME: Binding element 'settings' implicitly has an 'any'... Remove this comment to see the full error message
settings, 
// @ts-expect-error TS(7031) FIXME: Binding element 'siteInfo' implicitly has an 'any'... Remove this comment to see the full error message
siteInfo, }, 
// @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
req, 
// @ts-expect-error TS(7006) FIXME: Parameter 'res' implicitly has an 'any' type.
res) => {
    req.originalBody = ['GET', 'OPTIONS', 'HEAD'].includes(req.method)
        ? null
        : await createStreamPromise(req, BYTES_LIMIT);
    const edgeFunctionsProxyURL = await edgeFunctionsProxy(req, res);
    if (edgeFunctionsProxyURL !== undefined) {
        return proxy.web(req, res, { target: edgeFunctionsProxyURL });
    }
    const functionMatch = functionsRegistry && (await functionsRegistry.getFunctionForURLPath(req.url, req.method));
    if (functionMatch) {
        // Setting an internal header with the function name so that we don't
        // have to match the URL again in the functions server.
        /** @type {Record<string, string>} */
        const headers = {};
        if (functionMatch.func) {
            // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            headers[NFFunctionName] = functionMatch.func.name;
        }
        if (functionMatch.route) {
            // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            headers[NFFunctionRoute] = functionMatch.route.pattern;
        }
        return proxy.web(req, res, { headers, target: functionsServer });
    }
    const addonUrl = getAddonUrl(addonsUrls, req);
    if (addonUrl) {
        return handleAddonUrl({ req, res, addonUrl });
    }
    const match = await rewriter(req);
    const options = {
        match,
        addonsUrls,
        target: `http://${isIPv6(settings.frameworkHost) ? `[${settings.frameworkHost}]` : settings.frameworkHost}:${settings.frameworkPort}`,
        publicFolder: settings.dist,
        functionsServer,
        functionsPort: settings.functionsPort,
        jwtRolePath: settings.jwtRolePath,
        framework: settings.framework,
    };
    if (match) {
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
    const ct = req.headers['content-type'] ? contentType.parse(req).type : '';
    if (functionsServer &&
        req.method === 'POST' &&
        !isInternal(req.url) &&
        (ct.endsWith('/x-www-form-urlencoded') || ct === 'multipart/form-data')) {
        return proxy.web(req, res, { target: functionsServer });
    }
    if (isImageRequest(req)) {
        return imageProxy(req, res);
    }
    proxy.web(req, res, options);
};
/**
 * @param {Pick<import('./types.js').ServerSettings, "https" | "port">} settings
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'settings' implicitly has an 'any' type.
export const getProxyUrl = function (settings) {
    const scheme = settings.https ? 'https' : 'http';
    return `${scheme}://localhost:${settings.port}`;
};
export const startProxy = async function ({ 
// @ts-expect-error TS(7031) FIXME: Binding element 'accountId' implicitly has an 'any... Remove this comment to see the full error message
accountId, 
// @ts-expect-error TS(7031) FIXME: Binding element 'addonsUrls' implicitly has an 'an... Remove this comment to see the full error message
addonsUrls, 
// @ts-expect-error TS(7031) FIXME: Binding element 'blobsContext' implicitly has an '... Remove this comment to see the full error message
blobsContext, 
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
config, 
// @ts-expect-error TS(7031) FIXME: Binding element 'configPath' implicitly has an 'an... Remove this comment to see the full error message
configPath, 
// @ts-expect-error TS(7031) FIXME: Binding element 'debug' implicitly has an 'any' ty... Remove this comment to see the full error message
debug, 
// @ts-expect-error TS(7031) FIXME: Binding element 'env' implicitly has an 'any' type... Remove this comment to see the full error message
env, 
// @ts-expect-error TS(7031) FIXME: Binding element 'functionsRegistry' implicitly has... Remove this comment to see the full error message
functionsRegistry, 
// @ts-expect-error TS(7031) FIXME: Binding element 'geoCountry' implicitly has an 'an... Remove this comment to see the full error message
geoCountry, 
// @ts-expect-error TS(7031) FIXME: Binding element 'geolocationMode' implicitly has a... Remove this comment to see the full error message
geolocationMode, 
// @ts-expect-error TS(7031) FIXME: Binding element 'getUpdatedConfig' implicitly has ... Remove this comment to see the full error message
getUpdatedConfig, 
// @ts-expect-error TS(7031) FIXME: Binding element 'inspectSettings' implicitly has a... Remove this comment to see the full error message
inspectSettings, 
// @ts-expect-error TS(7031) FIXME: Binding element 'offline' implicitly has an 'any' ... Remove this comment to see the full error message
offline, 
// @ts-expect-error TS(7031) FIXME: Binding element 'projectDir' implicitly has an 'an... Remove this comment to see the full error message
projectDir, 
// @ts-expect-error TS(7031) FIXME: Binding element 'repositoryRoot' implicitly has an... Remove this comment to see the full error message
repositoryRoot, 
// @ts-expect-error TS(7031) FIXME: Binding element 'settings' implicitly has an 'any'... Remove this comment to see the full error message
settings, 
// @ts-expect-error TS(7031) FIXME: Binding element 'siteInfo' implicitly has an 'any'... Remove this comment to see the full error message
siteInfo, 
// @ts-expect-error TS(7031) FIXME: Binding element 'state' implicitly has an 'any' ty... Remove this comment to see the full error message
state, }) {
    const secondaryServerPort = settings.https ? await getAvailablePort() : null;
    const functionsServer = settings.functionsPort ? `http://127.0.0.1:${settings.functionsPort}` : null;
    const edgeFunctionsProxy = await initializeEdgeFunctionsProxy({
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
    const imageProxy = await initializeImageProxy({
        config,
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
    });
    const rewriter = await createRewriter({
        distDir: settings.dist,
        projectDir,
        jwtSecret: settings.jwtSecret,
        jwtRoleClaim: settings.jwtRolePath,
        configPath,
        geoCountry,
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
    });
    const primaryServer = settings.https
        ? https.createServer({ cert: settings.https.cert, key: settings.https.key }, onRequestWithOptions)
        : http.createServer(onRequestWithOptions);
    // @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
    const onUpgrade = function onUpgrade(req, socket, head) {
        proxy.ws(req, socket, head);
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
