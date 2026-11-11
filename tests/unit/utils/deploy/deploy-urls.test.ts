import { describe, expect, test } from 'vitest'

import { getDeployUrls } from '../../../../src/utils/deploy/deploy-urls.js'

const deploy = {
  id: 'deploy_id',
  admin_url: 'https://app.netlify.com/projects/test-site',
  branch: 'feature',
}

describe('getDeployUrls', () => {
  test('leaves out the server logs link when the deploy has no server', () => {
    expect(getDeployUrls(deploy, { deployToProduction: true }).serverLogsUrl).toBeUndefined()
    expect(getDeployUrls({ ...deploy, server: null }, { deployToProduction: false }).serverLogsUrl).toBeUndefined()
  })

  test('links to the server logs for a production deploy', () => {
    const { serverLogsUrl } = getDeployUrls(
      { ...deploy, server: { region: 'iad', script_id: 'script' } },
      { deployToProduction: true },
    )

    expect(serverLogsUrl).toBe('https://app.netlify.com/projects/test-site/server?panel=logs')
  })

  test("links to the branch's server logs for a draft deploy", () => {
    const { serverLogsUrl } = getDeployUrls(
      { ...deploy, server: { region: 'iad', script_id: 'script' } },
      { deployToProduction: false },
    )

    expect(serverLogsUrl).toBe('https://app.netlify.com/projects/test-site/server?panel=logs&branch=feature')
  })

  test('links to the server logs for a draft deploy without a branch', () => {
    const { serverLogsUrl } = getDeployUrls(
      { id: 'deploy_id', admin_url: deploy.admin_url, server: { region: 'iad', script_id: 'script' } },
      { deployToProduction: false },
    )

    expect(serverLogsUrl).toBe('https://app.netlify.com/projects/test-site/server?panel=logs')
  })
})
