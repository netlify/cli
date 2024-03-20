import { parseAllHeaders } from 'netlify-headers-parser';
import { NETLIFYDEVERR, log } from './command-helpers.js';
/**
 * Get the matching headers for `path` given a set of `rules`.
 *
 * @param {Object<string,Object<string,string[]>>!} headers
 * The rules to use for matching.
 *
 * @param {string!} path
 * The path to match against.
 *
 * @returns {Object<string,string[]>}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'headers' implicitly has an 'any' type.
export const headersForPath = function (headers, path) {
    // @ts-expect-error TS(7031) FIXME: Binding element 'forRegExp' implicitly has an 'any... Remove this comment to see the full error message
    const matchingHeaders = headers.filter(({ forRegExp }) => forRegExp.test(path)).map(getHeaderValues);
    const headersRules = Object.assign({}, ...matchingHeaders);
    return headersRules;
};
// @ts-expect-error TS(7031) FIXME: Binding element 'values' implicitly has an 'any' t... Remove this comment to see the full error message
const getHeaderValues = function ({ values }) {
    return values;
};
// @ts-expect-error TS(7031) FIXME: Binding element 'configPath' implicitly has an 'an... Remove this comment to see the full error message
export const parseHeaders = async function ({ configPath, headersFiles }) {
    const { errors, headers } = await parseAllHeaders({
        headersFiles,
        netlifyConfigPath: configPath,
        minimal: false,
    });
    handleHeadersErrors(errors);
    return headers;
};
// @ts-expect-error TS(7006) FIXME: Parameter 'errors' implicitly has an 'any' type.
const handleHeadersErrors = function (errors) {
    if (errors.length === 0) {
        return;
    }
    const errorMessage = errors.map(getErrorMessage).join('\n\n');
    log(NETLIFYDEVERR, `Headers syntax errors:\n${errorMessage}`);
};
// @ts-expect-error TS(7031) FIXME: Binding element 'message' implicitly has an 'any' ... Remove this comment to see the full error message
const getErrorMessage = function ({ message }) {
    return message;
};
export const NFFunctionName = 'x-nf-function-name';
export const NFFunctionRoute = 'x-nf-function-route';
export const NFRequestID = 'x-nf-request-id';
