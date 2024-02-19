import { NetlifyConfig } from '@netlify/build'
import express from 'express'
import { createIPX, ipxFSStorage, ipxHttpStorage, createIPXNodeServer } from 'ipx'

import { log, NETLIFYDEVERR } from '../../utils/command-helpers.js'
import { getProxyUrl } from '../../utils/proxy.js'
import type { ServerSettings } from '../../utils/types.d.ts'

export const IMAGE_URL_PATTERN = '/.netlify/images'

interface QueryParams {
  w?: string
  width?: string
  h?: string
  height?: string
  q?: string
  quality?: string
  fm?: string
  fit?: string
  position?: string
}

interface IpxParams {
  w?: string | null
  h?: string | null
  s?: string | null
  quality?: string | null
  format?: string | null
  fit?: string | null
  position?: string | null
}

// @ts-expect-error TS(7006) FIXME: Parameter 'config' implicitly has an 'any' type.
export const parseAllRemoteImages = function (config): { errors: ErrorObject[]; remotePatterns: RegExp[] } {
  const remotePatterns = [] as RegExp[]
  const errors = [] as ErrorObject[]
  const remoteImages = config?.images?.remote_images

  if (!remoteImages) {
    return { errors, remotePatterns }
  }

  for (const patternString of remoteImages) {
    try {
      const urlRegex = new RegExp(patternString)
      remotePatterns.push(urlRegex)
    } catch (error) {
      if (error instanceof Error) {
        errors.push({ message: `Invalid URL pattern '${patternString}': ${error.message}` })
      } else {
        errors.push({ message: `Invalid URL pattern '${patternString}': An unknown error occurred` })
      }
    }
  }

  return { errors, remotePatterns }
}

interface ErrorObject {
  message: string
}

const getErrorMessage = function ({ message }: { message: string }): string {
  return message
}

export const handleRemoteImagesErrors = async function (errors: ErrorObject[]) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = await errors.map(getErrorMessage).join('\n\n')
  log(NETLIFYDEVERR, `Remote images syntax errors:\n${errorMessage}`)
}

// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
export const parseRemoteImages = async function ({ config }) {
  if (!config) {
    return []
  }

  const { errors, remotePatterns } = await parseAllRemoteImages(config)
  await handleRemoteImagesErrors(errors)

  return remotePatterns
}

export const isImageRequest = function (req: Request): boolean {
  return req.url.startsWith(IMAGE_URL_PATTERN)
}

export const transformImageParams = function (query: QueryParams): string {
  const params: IpxParams = {}

  const width = query.w || query.width || null
  const height = query.h || query.height || null

  if (width && height) {
    // eslint-disable-next-line id-length
    params.s = `${width}x${height}`
  } else {
    // eslint-disable-next-line id-length
    params.w = width
    // eslint-disable-next-line id-length
    params.h = height
  }

  params.quality = query.q || query.quality || null
  params.format = query.fm || null

  const fit = query.fit || null
  params.fit = fit === 'contain' ? 'inside' : fit

  params.position = query.position || null

  return Object.entries(params)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}_${value}`)
    .join(',')
}

export const initializeProxy = async function ({
  config,
  settings,
}: {
  config: NetlifyConfig
  settings: ServerSettings
}) {
  const remoteImages = await parseRemoteImages({ config })
  const devServerUrl = getProxyUrl(settings)

  const ipx = createIPX({
    storage: ipxFSStorage({ dir: config?.build?.publish ?? './public' }),
    httpStorage: ipxHttpStorage({
      allowAllDomains: true,
    }),
  })

  const handler = createIPXNodeServer(ipx)
  const app = express()

  let lastTimeRemoteImagesConfigurationDetailsMessageWasLogged = 0

  app.use(IMAGE_URL_PATTERN, async (req, res) => {
    const { url, ...query } = req.query
    const sourceImagePath = url as string
    const modifiers = (await transformImageParams(query)) || `_`
    if (!sourceImagePath.startsWith('http://') && !sourceImagePath.startsWith('https://')) {
      // Construct the full URL for relative paths to request from development server
      const sourceImagePathWithLeadingSlash = sourceImagePath.startsWith('/') ? sourceImagePath : `/${sourceImagePath}`
      const fullImageUrl = `${devServerUrl}${encodeURIComponent(sourceImagePathWithLeadingSlash)}`
      console.log(`fullImageUrl: ${fullImageUrl}`)
      req.url = `/${modifiers}/${fullImageUrl}`
    } else {
      // If the image is remote, we first check if it's allowed by any of patterns
      if (!remoteImages.some((remoteImage) => remoteImage.test(sourceImagePath))) {
        const remoteImageNotAllowedLogMessage = `Remote image "${sourceImagePath}" source for Image CDN is not allowed.`

        // Contextual information about the remote image configuration is throttled
        // to avoid spamming the console as it's quite verbose
        // Each not allowed remote image will still be logged, just without configuration details
        if (Date.now() - lastTimeRemoteImagesConfigurationDetailsMessageWasLogged > 1000 * 30) {
          console.error(
            `${remoteImageNotAllowedLogMessage}\n\n${
              remoteImages.length === 0
                ? 'Currently no remote images are allowed.'
                : `Currently allowed remote images configuration details:\n${remoteImages
                    .map((pattern) => ` - ${pattern}`)
                    .join('\n')}`
            }\n\Refer to https://docs.netlify.com/image-cdn/overview/#remote-path for information about how to configure allowed remote images.`,
          )
          lastTimeRemoteImagesConfigurationDetailsMessageWasLogged = Date.now()
        } else {
          console.error(remoteImageNotAllowedLogMessage)
        }

        res.status(400).end()
        return
      }
      // Construct the full URL for remote paths
      req.url = `/${modifiers}/${encodeURIComponent(sourceImagePath)}`
    }

    handler(req, res)
  })

  return app
}
