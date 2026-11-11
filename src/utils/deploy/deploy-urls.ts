export interface DeployUrls {
  siteUrl: string
  deployUrl: string
  logsUrl: string
  functionLogsUrl: string
  edgeFunctionLogsUrl: string
  serverLogsUrl?: string | undefined
}

interface DeployUrlFields {
  id?: string
  ssl_url?: string
  url?: string
  deploy_ssl_url?: string
  deploy_url?: string
  admin_url?: string
  branch?: string
  server?: object | null
}

const getServerLogsUrl = (deploy: DeployUrlFields, deployToProduction: boolean): string | undefined => {
  if (!deploy.server) {
    return undefined
  }

  const params = new URLSearchParams({ panel: 'logs' })
  // Server logs are kept per branch, not per deploy.
  if (!deployToProduction && deploy.branch) {
    params.set('branch', deploy.branch)
  }

  return `${deploy.admin_url ?? ''}/server?${params.toString()}`
}

export const getDeployUrls = (
  deploy: DeployUrlFields,
  { deployToProduction }: { deployToProduction: boolean },
): DeployUrls => {
  const functionLogsUrl = `${deploy.admin_url ?? ''}/logs/functions`
  const edgeFunctionLogsUrl = `${deploy.admin_url ?? ''}/logs/edge-functions`

  return {
    siteUrl: deploy.ssl_url ?? deploy.url ?? '',
    deployUrl: deploy.deploy_ssl_url ?? deploy.deploy_url ?? '',
    logsUrl: `${deploy.admin_url ?? ''}/deploys/${deploy.id ?? ''}`,
    functionLogsUrl: deployToProduction ? functionLogsUrl : `${functionLogsUrl}?scope=deploy:${deploy.id ?? ''}`,
    edgeFunctionLogsUrl: deployToProduction
      ? edgeFunctionLogsUrl
      : `${edgeFunctionLogsUrl}?scope=deployid:${deploy.id ?? ''}`,
    serverLogsUrl: getServerLogsUrl(deploy, deployToProduction),
  }
}
