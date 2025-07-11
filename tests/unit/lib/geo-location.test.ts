import nock from 'nock'
import { describe, expect, test } from 'vitest'

import { mockLocation } from '@netlify/dev-utils'
import { getGeoLocation, type Geolocation } from '../../../src/lib/geo-location.js'

describe('getGeoLocation', () => {
  test('returns geolocation data from the API if `mode: "cache"`', async () => {
    let hasCalledStateSet = false

    const testLocation = {
      city: 'Netlify Town',
      country: { code: 'NF', name: 'Netlify' },
      subdivision: { code: 'JS', name: 'Jamstack' },
    }
    const mockState = {
      get() {},
      set(key: string, value: { data: Geolocation; timestamp: number }) {
        hasCalledStateSet = true

        expect(key).toBe('geolocation')
        expect(value).toHaveProperty('data', testLocation)
        expect(value).toHaveProperty('timestamp', expect.any(Number))
      },
    }
    const mockRequest = nock('https://netlifind.netlify.app').get('/').reply(200, {
      geo: testLocation,
    })
    const geo = await getGeoLocation({ mode: 'cache', state: mockState })

    expect(mockRequest.isDone()).toBe(true)
    expect(hasCalledStateSet).toBe(true)
    expect(geo).toEqual(testLocation)
  })

  test('returns geolocation data from cache if data is younger than TTL', async () => {
    let hasCalledStateSet = false

    const testLocation = {
      city: 'Netlify Town',
      country: { code: 'NF', name: 'Netlify' },
      subdivision: { code: 'JS', name: 'Jamstack' },
    }
    const mockState = {
      get(key: string) {
        expect(key).toBe('geolocation')

        return {
          data: testLocation,
          timestamp: Date.now() - 3,
        }
      },
      set() {
        hasCalledStateSet = true
      },
    }
    const mockRequest = nock('https://netlifind.netlify.app').get('/').reply(200, {
      geo: testLocation,
    })
    const geo = await getGeoLocation({ mode: 'cache', state: mockState })

    expect(mockRequest.isDone()).toBe(false)
    expect(hasCalledStateSet).toBe(false)
    expect(geo).toEqual(testLocation)
  })

  test('returns geolocation data from cache, even if older than TTL, if the application is offline', async () => {
    let hasCalledStateSet = false

    const testLocation = {
      city: 'Netlify Town',
      country: { code: 'NF', name: 'Netlify' },
      subdivision: { code: 'JS', name: 'Jamstack' },
    }
    const mockState = {
      get(key: string) {
        expect(key).toBe('geolocation')

        return {
          data: testLocation,
          timestamp: 0,
        }
      },
      set() {
        hasCalledStateSet = true
      },
    }
    const mockRequest = nock('https://netlifind.netlify.app').get('/').reply(200, {
      geo: testLocation,
    })
    const geo = await getGeoLocation({ mode: 'cache', offline: true, state: mockState })

    expect(mockRequest.isDone()).toBe(false)
    expect(hasCalledStateSet).toBe(false)
    expect(geo).toEqual(testLocation)
  })

  test('returns mock geolocation data if `mode: "mock"`', async () => {
    let hasCalledStateSet = false

    const testLocation = {
      city: 'Netlify Town',
      country: { code: 'NF', name: 'Netlify' },
      subdivision: { code: 'JS', name: 'Jamstack' },
    }
    const mockState = {
      get() {},
      set() {
        hasCalledStateSet = true
      },
    }
    const mockRequest = nock('https://netlifind.netlify.app').get('/').reply(200, {
      geo: testLocation,
    })
    const geo = await getGeoLocation({ mode: 'mock', state: mockState })

    expect(mockRequest.isDone()).toBe(false)
    expect(hasCalledStateSet).toBe(false)
    expect(geo).toEqual(mockLocation)
  })

  test('returns mock geolocation data if valid country code set', async () => {
    const returnedLocation = {
      city: 'Mock City',
      country: { code: 'CA', name: 'Mock Country' },
      subdivision: { code: 'SD', name: 'Mock Subdivision' },
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
    }

    const mockState = {
      get() {},
      set() {},
    }

    const geo = await getGeoLocation({ mode: 'mock', state: mockState, geoCountry: 'CA' })

    expect(geo).toEqual(returnedLocation)
  })

  test('mocks country code when not using mock flag', async () => {
    const mockState = {
      get() {},
      set() {},
    }

    const returnedLocation = {
      city: 'Mock City',
      country: { code: 'CA', name: 'Mock Country' },
      subdivision: { code: 'SD', name: 'Mock Subdivision' },
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
    }

    const geo = await getGeoLocation({ mode: 'update', offline: false, state: mockState, geoCountry: 'CA' })

    expect(geo).toEqual(returnedLocation)
  })
})
