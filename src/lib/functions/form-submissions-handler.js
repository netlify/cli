import { Readable } from 'stream';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'cont... Remove this comment to see the full error message
import { parse as parseContentType } from 'content-type';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'mult... Remove this comment to see the full error message
import multiparty from 'multiparty';
import getRawBody from 'raw-body';
import { warn } from '../../utils/command-helpers.js';
import { BACKGROUND } from '../../utils/functions/index.js';
import { capitalize } from '../string.js';
// @ts-expect-error TS(7031) FIXME: Binding element 'functionsRegistry' implicitly has... Remove this comment to see the full error message
const getFormHandler = function ({ functionsRegistry }) {
    const handlers = ['submission-created', `submission-created${BACKGROUND}`]
        .map((name) => functionsRegistry.get(name))
        .filter(Boolean)
        .map(({ name }) => name);
    if (handlers.length === 0) {
        warn(`Missing form submission function handler`);
        return;
    }
    if (handlers.length === 2) {
        warn(`Detected both '${handlers[0]}' and '${handlers[1]}' form submission functions handlers, using ${handlers[0]}`);
    }
    return handlers[0];
};
// @ts-expect-error TS(7031) FIXME: Binding element 'functionsRegistry' implicitly has... Remove this comment to see the full error message
export const createFormSubmissionHandler = function ({ functionsRegistry, siteUrl }) {
    // @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
    return async function formSubmissionHandler(req, res, next) {
        if (req.url.startsWith('/.netlify/') ||
            req.method !== 'POST' ||
            (await functionsRegistry.getFunctionForURLPath(req.url, req.method)))
            return next();
        const fakeRequest = new Readable({
            read() {
                this.push(req.body);
                this.push(null);
            },
        });
        // @ts-expect-error TS(2339) FIXME: Property 'headers' does not exist on type 'Readabl... Remove this comment to see the full error message
        fakeRequest.headers = req.headers;
        const handlerName = getFormHandler({ functionsRegistry });
        if (!handlerName) {
            return next();
        }
        const originalUrl = new URL(req.url, 'http://localhost');
        req.url = `/.netlify/functions/${handlerName}${originalUrl.search}`;
        const ct = parseContentType(req);
        let fields = {};
        let files = {};
        if (ct.type.endsWith('/x-www-form-urlencoded')) {
            const bodyData = await getRawBody(fakeRequest, {
                length: req.headers['content-length'],
                limit: '10mb',
                encoding: ct.parameters.charset,
            });
            fields = Object.fromEntries(new URLSearchParams(bodyData.toString()));
        }
        else if (ct.type === 'multipart/form-data') {
            try {
                ;
                [fields, files] = await new Promise((resolve, reject) => {
                    const form = new multiparty.Form({ encoding: ct.parameters.charset || 'utf8' });
                    // @ts-expect-error TS(7006) FIXME: Parameter 'err' implicitly has an 'any' type.
                    form.parse(fakeRequest, (err, Fields, Files) => {
                        if (err)
                            return reject(err);
                        Files = Object.entries(Files).reduce((prev, [name, values]) => ({
                            ...prev,
                            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
                            [name]: values.map((value) => ({
                                filename: value.originalFilename,
                                size: value.size,
                                type: value.headers && value.headers['content-type'],
                                url: value.path,
                            })),
                        }), {});
                        return resolve([
                            Object.entries(Fields).reduce(
                            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
                            (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }), {}),
                            Object.entries(Files).reduce(
                            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
                            (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }), {}),
                        ]);
                    });
                });
            }
            catch (error) {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
                warn(error);
                return next();
            }
        }
        else {
            warn('Invalid Content-Type for Netlify Dev forms request');
            return next();
        }
        const data = JSON.stringify({
            payload: {
                company: 
                // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
                fields[Object.keys(fields).find((name) => ['company', 'business', 'employer'].includes(name.toLowerCase()))],
                last_name: 
                // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
                fields[Object.keys(fields).find((name) => ['lastname', 'surname', 'byname'].includes(name.toLowerCase()))],
                first_name: fields[
                // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
                Object.keys(fields).find((name) => ['firstname', 'givenname', 'forename'].includes(name.toLowerCase()))],
                // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
                name: fields[Object.keys(fields).find((name) => ['name', 'fullname'].includes(name.toLowerCase()))],
                email: fields[
                // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
                Object.keys(fields).find((name) => ['email', 'mail', 'from', 'twitter', 'sender'].includes(name.toLowerCase()))],
                // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
                title: fields[Object.keys(fields).find((name) => ['title', 'subject'].includes(name.toLowerCase()))],
                data: {
                    ...fields,
                    ...files,
                    ip: req.connection.remoteAddress,
                    user_agent: req.headers['user-agent'],
                    referrer: req.headers.referer,
                },
                created_at: new Date().toISOString(),
                human_fields: Object.entries({
                    ...fields,
                    // @ts-expect-error TS(2339) FIXME: Property 'url' does not exist on type 'unknown'.
                    ...Object.entries(files).reduce((prev, [name, { url }]) => ({ ...prev, [name]: url }), {}),
                }).reduce((prev, [key, val]) => ({ ...prev, [capitalize(key)]: val }), {}),
                ordered_human_fields: Object.entries({
                    ...fields,
                    // @ts-expect-error TS(2339) FIXME: Property 'url' does not exist on type 'unknown'.
                    ...Object.entries(files).reduce((prev, [name, { url }]) => ({ ...prev, [name]: url }), {}),
                }).map(([key, val]) => ({ title: capitalize(key), name: key, value: val })),
                site_url: siteUrl,
            },
        });
        req.body = data;
        req.headers = {
            ...req.headers,
            'content-length': data.length,
            'content-type': 'application/json',
            'x-netlify-original-pathname': originalUrl.pathname,
            'x-netlify-original-search': originalUrl.search,
        };
        next();
    };
};
