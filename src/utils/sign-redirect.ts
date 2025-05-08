import jwt from 'jsonwebtoken'

// https://docs.netlify.com/routing/redirects/rewrites-proxies/#signed-proxy-redirects
// @ts-expect-error TS(7031) FIXME: Binding element 'deployContext' implicitly has an ... Remove this comment to see the full error message
export const signRedirect = ({ deployContext, secret, siteID, siteURL }) => { // siteID and siteURL parameters kept for backward compatibility
  const claims = {
    deploy_context: deployContext,
    netlify_id: siteID, // project ID
    site_url: siteURL, // project URL
  }
  const options = {
    expiresIn: '5 minutes' as const,
    issuer: 'netlify',
  }

  return jwt.sign(claims, secret, options)
}
