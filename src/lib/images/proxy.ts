import type { IncomingMessage, ServerResponse } from 'http'

import { type ImageHandler } from '@netlify/images'

import { getProxyUrl } from '../../utils/proxy.js'
import type { ServerSettings } from '../../utils/types.d.ts'
import { fromWebResponse, toWebRequest } from '@netlify/dev-utils'

export const IMAGE_URL_PATTERN = '/.netlify/images'

export const isImageRequest = function (req: IncomingMessage): boolean {
  return req.url?.startsWith(IMAGE_URL_PATTERN) ?? false
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
