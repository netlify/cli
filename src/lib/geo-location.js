// @ts-check
const fetch = require('node-fetch')

const API_URL = 'https://netlifind.netlify.app'
const STATE_GEO_PROPERTY = 'geolocation'

// 24 hours
const CACHE_TTL = 8.64e7

// 10 seconds
const REQUEST_TIMEOUT = 1e4

/**
 * @typedef GeoLocation
 * @type {object}
 * @property {string} city
 * @property {object} country
 * @property {string} country.code
 * @property {string} country.name
 * @property {object} country
 * @property {string} country.code
 * @property {string} country.name
 */

// The default location to be used if we're unable to talk to the API.
const mockLocation = {
  city: 'San Francisco',
  country: { code: 'US', name: 'United States' },
  subdivision: { code: 'CA', name: 'California' },
}

/**
 * Returns geolocation data from a remote API, the local cache, or a mock
 * location, depending on the mode selected.
 *
 * @param {object} params
 * @param {string} params.geolocationMode
 * @param {"cache"|"update"|"mock"} params.mode
 * @param {boolean} params.offline
 * @param {import('../utils/state-config').StateConfig} params.state
 * @returns {Promise<GeoLocation>}
 */
const getGeoLocation = async ({ mode, offline, state }) => {
  const cacheObject = state.get(STATE_GEO_PROPERTY)

  // If we have cached geolocation data and the `--geo` option is set to
  // `cache`, let's try to use it.
  if (cacheObject !== undefined && mode === 'cache') {
    const age = Date.now() - cacheObject.timestamp

    // Let's use the cached data if it's not older than the TTL. Also, if the
    // `--offline` option was used, it's best to use the cached location than
    // the mock one.
    if (age < CACHE_TTL || offline) {
      return cacheObject.data
    }
  }

  // If the `--geo` option is set to `mock`, we use the mock location. Also,
  // if the `--offline` option was used, we can't talk to the API, so let's
  // also use the mock location.
  if (mode === 'mock' || offline) {
    return mockLocation
  }

  // Trying to retrieve geolocation data from the API and caching it locally.
  try {
    const data = await getGeoLocationFromAPI()
    const newCacheObject = {
      data,
      timestamp: Date.now(),
    }

    state.set(STATE_GEO_PROPERTY, newCacheObject)

    return data
  } catch {
    // We couldn't get geolocation data from the API, so let's return the
    // mock location.
    return mockLocation
  }
}

/**
 * Returns geolocation data from a remote API
 *
 * @returns {Promise<GeoLocation>}
 */
const getGeoLocationFromAPI = async () => {
  const res = await fetch(API_URL, {
    method: 'GET',
    timeout: REQUEST_TIMEOUT,
  })
  const { geo } = await res.json()

  return geo
}

module.exports = { getGeoLocation, mockLocation }
