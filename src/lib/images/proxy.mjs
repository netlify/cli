import express from 'express'
import { createIPX, ipxFSStorage, ipxHttpStorage, createIPXNodeServer } from 'ipx'

import { log, NETLIFYDEVERR } from '../../utils/command-helpers.mjs'

export const IMAGE_URL_PATTERN = '/.netlify/images'

export const parseAllDomains = function (config) {
  const domains = config?.images?.remote_images
  if (!domains) {
    return { errors: [], remoteDomains: [] }
  }

  const remoteDomains = []
  const errors = []

  for (const patternString of domains) {
    try {
      const url = new URL(patternString)
      if (url.hostname) {
        remoteDomains.push(url.hostname)
      } else {
        errors.push(`The URL '${patternString}' does not have a valid hostname.`)
      }
    } catch (error) {
      errors.push(`Invalid URL '${patternString}': ${error.message}`)
    }
  }

  return { errors, remoteDomains }
}

const getErrorMessage = function ({ message }) {
  return message
}

export const handleImageDomainsErrors = async function (errors) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = await errors.map(getErrorMessage).join('\n\n')
  log(NETLIFYDEVERR, `Image domains syntax errors:\n${errorMessage}`)
}

export const parseRemoteImageDomains = async function ({ config }) {
  if (!config) {
    return []
  }

  const { errors, remoteDomains } = await parseAllDomains(config)
  await handleImageDomainsErrors(errors)

  return remoteDomains
}
export const isImageRequest = function (req) {
  return req.url.startsWith(IMAGE_URL_PATTERN)
}

export const transformImageParams = function (query) {
  const params = {}

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
  params.fit = query.fit || null
  params.position = query.position || null

  return Object.entries(params)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}_${value}`)
    .join(',')
}

export const initializeProxy = async function ({ config }) {
  const remoteDomains = await parseRemoteImageDomains({ config })

  const ipx = createIPX({
    storage: ipxFSStorage({ dir: config?.build?.publish ?? './public' }),
    httpStorage: ipxHttpStorage({ domains: remoteDomains }),
  })

  const handler = createIPXNodeServer(ipx)
  const app = express()

  app.use(IMAGE_URL_PATTERN, async (req, res) => {
    const { url, ...query } = req.query
    const modifiers = await transformImageParams(query)
    const path = `/${modifiers}/${encodeURIComponent(url)}`
    req.url = path
    handler(req, res)
  })

  return app
}
