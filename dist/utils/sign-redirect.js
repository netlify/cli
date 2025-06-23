import jwt from 'jsonwebtoken';
// https://docs.netlify.com/routing/redirects/rewrites-proxies/#signed-proxy-redirects
// @ts-expect-error TS(7031) FIXME: Binding element 'deployContext' implicitly has an ... Remove this comment to see the full error message
export const signRedirect = ({ deployContext, secret, siteID, siteURL }) => {
    const claims = {
        deploy_context: deployContext,
        netlify_id: siteID,
        site_url: siteURL,
    };
    const options = {
        expiresIn: '5 minutes',
        issuer: 'netlify',
    };
    return jwt.sign(claims, secret, options);
};
//# sourceMappingURL=sign-redirect.js.map