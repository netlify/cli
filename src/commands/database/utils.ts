const JIGSAW_URL = 'https://jigsaw.services-prod.nsvcs.net'

export const getExtensionInstallations = async ({
  siteId,
  accountId,
  token,
}: {
  siteId: string
  accountId: string
  token: string
}) => {
  const installationsResponse = await fetch(
    `${JIGSAW_URL}/team/${encodeURIComponent(accountId)}/integrations/installations/${encodeURIComponent(siteId)}`,
    {
      headers: {
        'netlify-token': token,
      },
    },
  )

  if (!installationsResponse.ok) {
    return new Response('Failed to fetch installed extensions for site', {
      status: 500,
    })
  }

  const installations = await installationsResponse.json()
  // console.log('installations', installations)
  return installations
}

export const getExtension = async ({ accountId, token, slug }: { accountId: string; token: string; slug: string }) => {
  const fetchExtensionUrl = new URL('/.netlify/functions/fetch-extension', 'https://app.netlify.com/')
  fetchExtensionUrl.searchParams.append('teamId', accountId)
  fetchExtensionUrl.searchParams.append('slug', slug)

  const extensionReq = await fetch(fetchExtensionUrl.toString(), {
    headers: {
      Cookie: `_nf-auth=${token}`,
    },
  })
  const extension = (await extensionReq.json()) as
    | {
        hostSiteUrl?: string
      }
    | undefined

  return extension
}

export const installExtension = async ({
  token,
  accountId,
  slug,
  hostSiteUrl,
}: {
  token: string
  accountId: string
  slug: string
  hostSiteUrl: string
}) => {
  const installExtensionResponse = await fetch(`https://app.netlify.com/.netlify/functions/install-extension`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `_nf-auth=${token}`,
    },
    body: JSON.stringify({
      teamId: accountId,
      slug,
      hostSiteUrl,
    }),
  })

  if (!installExtensionResponse.ok) {
    throw new Error(`Failed to install extension: ${slug}`)
  }

  const installExtensionData = await installExtensionResponse.json()
  console.log('installExtensionData', installExtensionData)

  return installExtensionData
}
