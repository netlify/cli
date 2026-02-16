export interface DeployUrls {
  siteUrl: string
  deployUrl: string
  logsUrl: string
  functionLogsUrl: string
  edgeFunctionLogsUrl: string
}

/**
 * Derive all relevant URLs from a deploy object (as returned by the Netlify API).
 */
export const getDeployUrls = (
  deploy: {
    id?: string
    ssl_url?: string
    url?: string
    deploy_ssl_url?: string
    deploy_url?: string
    admin_url?: string
  },
  { deployToProduction = true }: { deployToProduction?: boolean } = {},
): DeployUrls => {
  const siteUrl = deploy.ssl_url || deploy.url || ''
  const deployUrl = deploy.deploy_ssl_url || deploy.deploy_url || ''
  const adminUrl = deploy.admin_url ?? ''
  const id = deploy.id ?? ''
  const logsUrl = `${adminUrl}/deploys/${id}`

  let functionLogsUrl = `${adminUrl}/logs/functions`
  let edgeFunctionLogsUrl = `${adminUrl}/logs/edge-functions`

  if (!deployToProduction && id) {
    functionLogsUrl += `?scope=deploy:${id}`
    edgeFunctionLogsUrl += `?scope=deployid:${id}`
  }

  return { siteUrl, deployUrl, logsUrl, functionLogsUrl, edgeFunctionLogsUrl }
}
