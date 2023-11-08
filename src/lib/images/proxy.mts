import express from 'express'
import { createIPX, ipxFSStorage, ipxHttpStorage, createIPXNodeServer } from 'ipx'

import { log, NETLIFYDEVERR } from '../../utils/command-helpers.mjs'

export const IMAGE_URL_PATTERN = '/.netlify/images'

// @ts-expect-error TS(7006) FIXME: Parameter 'config' implicitly has an 'any' type.
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
      // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
      errors.push(`Invalid URL '${patternString}': ${error.message}`)
    }
  }

  return { errors, remoteDomains }
}

// @ts-expect-error TS(7031) FIXME: Binding element 'message' implicitly has an 'any' ... Remove this comment to see the full error message
const getErrorMessage = function ({ message }) {
  return message
}

// @ts-expect-error TS(7006) FIXME: Parameter 'errors' implicitly has an 'any' type.
export const handleImageDomainsErrors = async function (errors) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = await errors.map(getErrorMessage).join('\n\n')
  log(NETLIFYDEVERR, `Image domains syntax errors:\n${errorMessage}`)
}

// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
export const parseRemoteImageDomains = async function ({ config }) {
  if (!config) {
    return []
  }

  const { errors, remoteDomains } = await parseAllDomains(config)
  await handleImageDomainsErrors(errors)

  return remoteDomains
}
// @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
export const isImageRequest = function (req) {
  return req.url.startsWith(IMAGE_URL_PATTERN)
}

// @ts-expect-error TS(7006) FIXME: Parameter 'query' implicitly has an 'any' type.
export const transformImageParams = function (query) {
  const params = {}
  // @ts-expect-error TS(2339) FIXME: Property 'w' does not exist on type '{}'.
  // eslint-disable-next-line id-length
  params.w = query.w || query.width || null
  // @ts-expect-error TS(2339) FIXME: Property 'h' does not exist on type '{}'.
  // eslint-disable-next-line id-length
  params.h = query.h || query.height || null
  // @ts-expect-error TS(2339) FIXME: Property 'quality' does not exist on type '{}'.
  params.quality = query.q || query.quality || null
  // @ts-expect-error TS(2339) FIXME: Property 'format' does not exist on type '{}'.
  params.format = query.fm || null
  // @ts-expect-error TS(2339) FIXME: Property 'fit' does not exist on type '{}'.
  params.fit = mapImgixToFitIpx(query.fit, query.crop)
  // @ts-expect-error TS(2339) FIXME: Property 'position' does not exist on type '{}'.
  params.position = query.crop || null

  return Object.entries(params)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}_${value}`)
    .join(',')
}

// @ts-expect-error TS(7006) FIXME: Parameter 'fit' implicitly has an 'any' type.
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

  // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return fitMapping[fit] ?? 'contain'
}

// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
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
    // @ts-expect-error TS(2345) FIXME: Argument of type 'string | string[] | ParsedQs | P... Remove this comment to see the full error message
    const path = `/${modifiers}/${encodeURIComponent(url)}`
    req.url = path
    handler(req, res)
  })

  return app
}
