import jwt from 'jsonwebtoken'

// https://docs.netlify.com/routing/redirects/rewrites-proxies/#signed-proxy-redirects
export const signRedirect = ({
  deployContext,
  secret,
  siteID,
  siteURL,
}: {
  deployContext: string
  secret: string
  siteID: string | undefined
  siteURL: string | undefined
}) => {
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
