import express from 'express'
import { createIPX, ipxFSStorage, ipxHttpStorage, createIPXNodeServer } from 'ipx'

import { log, NETLIFYDEVERR } from '../../utils/command-helpers.mjs'

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

const imageUrlPattern = '/.netlify/images'
export const isImageRequest = function (req) {
  return req.url.startsWith(imageUrlPattern)
}

export const transformImageParams = function (query) {
  const params = {}
  // eslint-disable-next-line id-length
  params.w = query.w || query.width || null
  // eslint-disable-next-line id-length
  params.h = query.h || query.height || null
  params.quality = query.q || query.quality || null
  params.format = query.fm || null
  params.fit = mapImgixToFitIpx(query.fit, query.crop)
  params.position = query.crop || null

  return Object.entries(params)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}_${value}`)
    .join(',')
}

function mapImgixToFitIpx(fit, crop) {
  if (crop) {
    return 'cover'
  }

  const fitMapping = {
    // IPX doesn't have exact equivalent.
    clamp: null,
    clip: 'contain',
    crop: 'cover',
    max: 'inside',
    min: 'outside',
    scale: 'fill',
  }

  return fitMapping[fit] ?? 'contain'
}

export const initializeProxy = async function ({ config }) {
  const remoteDomains = await parseRemoteImageDomains({ config })

  const ipx = createIPX({
    storage: ipxFSStorage({ dir: config?.build?.publish ?? './public' }),
    httpStorage: ipxHttpStorage({ domains: remoteDomains }),
  })

  const handler = createIPXNodeServer(ipx)
  const app = express()

  app.use('/.netlify/images', async (req, res) => {
    const { url, ...query } = req.query
    const modifiers = await transformImageParams(query)
    const path = `/${modifiers}/${encodeURIComponent(url)}`
    req.url = path
    handler(req, res)
  })

  return app
}
