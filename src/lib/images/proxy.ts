import type { IncomingMessage, ServerResponse } from 'http'

import { ImageHandler } from '@netlify/images'

import { type NormalizedCachedConfigConfig } from '../../utils/command-helpers.js'
import { getProxyUrl } from '../../utils/proxy.js'
import type { ServerSettings } from '../../utils/types.d.ts'
import { fromWebResponse, toWebRequest } from '@netlify/dev-utils'

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

export const parseAllRemoteImages = function (config: Pick<NormalizedCachedConfigConfig, 'images'>): {
  errors: ErrorObject[]
  remotePatterns: RegExp[]
} {
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
      const message = error instanceof Error ? error.message : 'An unknown error occurred'

      errors.push({ message })
    }
  }

  return { errors, remotePatterns }
}

interface ErrorObject {
  message: string
}

export const isImageRequest = function (req: IncomingMessage): boolean {
  return req.url?.startsWith(IMAGE_URL_PATTERN) ?? false
}

export const transformImageParams = function (query: QueryParams): string {
  const params: IpxParams = {}

  const width = query.w || query.width || null
  const height = query.h || query.height || null

  if (width && height) {
    params.s = `${width}x${height}`
  } else {
    params.w = width
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

export const initializeProxy = function ({
  settings,
  imageHandler,
}: {
  settings: ServerSettings
  imageHandler: ImageHandler
}) {
  const devServerUrl = getProxyUrl(settings)

  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const webRequest = toWebRequest(req)
      const match = imageHandler.match(webRequest)
      if (!match) {
        res.statusCode = 404
        res.end('Image not found')
        return
      }

      const response = await match.handle(devServerUrl)
      await fromWebResponse(response, res)
    } catch (error) {
      console.error('Image proxy error:', error)
      res.statusCode = 500
      res.end('Internal server error')
    }
  }
}
