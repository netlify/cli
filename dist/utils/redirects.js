import { parseAllRedirects } from '@netlify/redirect-parser';
import { NETLIFYDEVERR, log } from './command-helpers.js';
// Parse, normalize and validate all redirects from `_redirects` files
// and `netlify.toml`
// @ts-expect-error TS(7031) FIXME: Binding element 'configPath' implicitly has an 'an... Remove this comment to see the full error message
export const parseRedirects = async function ({ config, configPath, redirectsFiles }) {
    const { errors, redirects } = await parseAllRedirects({
        redirectsFiles,
        netlifyConfigPath: configPath,
        minimal: false,
        configRedirects: config?.redirects || [],
    });
    handleRedirectParsingErrors(errors);
    // @ts-expect-error TS(2345) FIXME: Argument of type '({ conditions: { country, langua... Remove this comment to see the full error message
    return redirects.map(normalizeRedirect);
};
// @ts-expect-error TS(7006) FIXME: Parameter 'errors' implicitly has an 'any' type.
const handleRedirectParsingErrors = function (errors) {
    if (errors.length === 0) {
        return;
    }
    const errorMessage = errors.map(getErrorMessage).join('\n\n');
    log(NETLIFYDEVERR, `Redirects syntax errors:\n${errorMessage}`);
};
// @ts-expect-error TS(7031) FIXME: Binding element 'message' implicitly has an 'any' ... Remove this comment to see the full error message
const getErrorMessage = function ({ message }) {
    return message;
};
// `netlify-redirector` does not handle the same shape as the backend:
//  - `from` is called `origin`
//  - `query` is called `params`
//  - `conditions.role|country|language` are capitalized
const normalizeRedirect = function ({ 
// @ts-expect-error TS(7031) FIXME: Binding element 'country' implicitly has an 'any' ... Remove this comment to see the full error message
conditions: { country, language, role, ...conditions }, 
// @ts-expect-error TS(7031) FIXME: Binding element 'from' implicitly has an 'any' typ... Remove this comment to see the full error message
from, 
// @ts-expect-error TS(7031) FIXME: Binding element 'query' implicitly has an 'any' ty... Remove this comment to see the full error message
query, 
// @ts-expect-error TS(7031) FIXME: Binding element 'signed' implicitly has an 'any' t... Remove this comment to see the full error message
signed, ...redirect }) {
    return {
        ...redirect,
        origin: from,
        params: query,
        conditions: {
            ...conditions,
            ...(role && { Role: role }),
            ...(country && { Country: country }),
            ...(language && { Language: language }),
        },
        ...(signed && {
            sign: {
                jwt_secret: signed,
            },
        }),
    };
};
//# sourceMappingURL=redirects.js.map