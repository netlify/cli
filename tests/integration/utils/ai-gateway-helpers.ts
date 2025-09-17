import { TestContext } from 'vitest'

export const createAIGatewayTestData = () => {
  const siteInfo = {
    account_slug: 'test-account',
    id: 'test-site-id',
    name: 'site-name',
    ssl_url: 'https://test-site.netlify.app',
  }

  const aiGatewayToken = {
    token: 'ai-gateway-token-123',
    url: 'https://api.netlify.com/.netlify/ai/',
  }

  const routes = [
    { path: 'sites/test-site-id', response: siteInfo },
    { path: 'sites/test-site-id/service-instances', response: [] },
    { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
    { path: 'accounts/test-account/env', response: [] },
    { path: 'sites/test-site-id/ai-gateway/token', response: aiGatewayToken },
    { path: 'ai-gateway/providers', response: { providers: {} } },
  ]

  return { siteInfo, aiGatewayToken, routes }
}

export const createAIGatewayCheckFunction = (version: 'v1' | 'v2' = 'v1') => {
  if (version === 'v2') {
    return {
      path: 'netlify/functions/check-ai-gateway-v2.js',
      content: `export default () => {
  return new Response(
    JSON.stringify({
      hasAIGateway: !!process.env.AI_GATEWAY,
      aiGatewayValue: process.env.AI_GATEWAY || null,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}
export const config = { path: "/check-ai-gateway-v2" }`,
      urlPath: '/check-ai-gateway-v2',
    }
  }

  return {
    path: 'check-ai-gateway.js',
    handler: `async () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          hasAIGateway: !!process.env.AI_GATEWAY,
          aiGatewayValue: process.env.AI_GATEWAY || null,
        }),
      }
    }`,
    urlPath: '/.netlify/functions/check-ai-gateway',
  }
}

export const assertAIGatewayValue = (
  t: TestContext,
  result: { hasAIGateway: boolean; aiGatewayValue: string | null },
  expectedToken: string,
  expectedUrl: string,
) => {
  t.expect(result.hasAIGateway).toBe(true)
  t.expect(result.aiGatewayValue).toBeDefined()

  if (result.aiGatewayValue) {
    const decodedPayload = JSON.parse(Buffer.from(result.aiGatewayValue, 'base64').toString()) as {
      token: string
      url: string
    }
    t.expect(decodedPayload).toHaveProperty('token', expectedToken)
    t.expect(decodedPayload).toHaveProperty('url', expectedUrl)
  }
}

export const createMockApiFailureRoutes = (siteInfo: { account_slug: string; id: string; name: string; ssl_url: string | null }) => [
  { path: 'sites/test-site-id', response: siteInfo },
  { path: 'sites/test-site-id/service-instances', response: [] },
  { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
  { path: 'accounts/test-account/env', response: [] },
  { path: 'sites/test-site-id/ai-gateway/token', status: 404, response: { message: 'Not Found' } },
  { path: 'ai-gateway/providers', status: 404, response: { message: 'Not Found' } },
]