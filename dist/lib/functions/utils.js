import { chalk, warn } from '../../utils/command-helpers.js';
import { MISSING_AWS_SDK_WARNING } from '../log.js';
export const warnIfAwsSdkError = ({ error }) => {
    const isAwsSdkError = typeof error === 'object' &&
        'errorMessage' in error &&
        typeof error.errorMessage === 'string' &&
        error.errorMessage.includes("Cannot find module 'aws-sdk'");
    if (isAwsSdkError) {
        warn(MISSING_AWS_SDK_WARNING);
    }
};
export const formatLambdaError = (err) => chalk.red(`${'errorType' in err ? err.errorType : 'Error'}: ${'errorMessage' in err ? err.errorMessage : err.message}`);
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
export const styleFunctionName = (name) => chalk.magenta(name);
//# sourceMappingURL=utils.js.map