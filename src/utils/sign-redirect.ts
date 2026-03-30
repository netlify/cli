import jwt from 'jsonwebtoken'

interface SignRedirectOptions {
  deployContext: string
  secret: string
  siteID: string
  siteURL: string
}

// https://docs.netlify.com/routing/redirects/rewrites-proxies/#signed-proxy-redirects
export const signRedirect = ({ deployContext, secret, siteID, siteURL }: SignRedirectOptions) => {
  const claims = {
    deploy_context: deployContext,
    netlify_id: siteID,
    site_url: siteURL,
  }
  const options = {
    expiresIn: '5 minutes' as const,
    issuer: 'netlify',
  }

  return jwt.sign(claims, secret, options)
}
