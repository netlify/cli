import { chalk, warn } from '../../utils/command-helpers.js';
import { MISSING_AWS_SDK_WARNING } from '../log.js';
// @ts-expect-error TS(7031) FIXME: Binding element 'error' implicitly has an 'any' ty... Remove this comment to see the full error message
export const detectAwsSdkError = ({ error }) => {
    const isAwsSdkError = error && error.errorMessage && error.errorMessage.includes("Cannot find module 'aws-sdk'");
    if (isAwsSdkError) {
        warn(MISSING_AWS_SDK_WARNING);
    }
};
// @ts-expect-error TS(7006) FIXME: Parameter 'err' implicitly has an 'any' type.
export const formatLambdaError = (err) => chalk.red(`${err.errorType}: ${err.errorMessage}`);
// should be equivalent to https://github.com/netlify/proxy/blob/main/pkg/functions/request.go#L105
const exceptionsList = new Set([
    'application/csp-report',
    'application/graphql',
    'application/json',
    'application/javascript',
    'application/x-www-form-urlencoded',
    'application/x-ndjson',
    'application/xml',
]);
/**
 * @param {string | undefined} contentType
 * @returns {boolean}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'contentType' implicitly has an 'any' ty... Remove this comment to see the full error message
export const shouldBase64Encode = function (contentType) {
    if (!contentType) {
        return true;
    }
    const [contentTypeSegment] = contentType.split(';');
    contentType = contentTypeSegment;
    contentType = contentType.toLowerCase();
    if (contentType.startsWith('text/')) {
        return false;
    }
    if (contentType.endsWith('+json') || contentType.endsWith('+xml')) {
        return false;
    }
    if (exceptionsList.has(contentType)) {
        return false;
    }
    return true;
};
// @ts-expect-error TS(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
export const styleFunctionName = (name) => chalk.magenta(name);
