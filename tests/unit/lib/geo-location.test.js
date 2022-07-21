const test = require('ava')
const nock = require('nock')

const { defaultMockLocation, getGeoLocation } = require('../../../src/lib/geo-location')

test('`getGeoLocation` returns geolocation data from the API if `mode: "cache"`', async (t) => {
  let hasCalledStateSet = false

  const testLocation = {
    city: 'Netlify Town',
    country: { code: 'NF', name: 'Netlify' },
    subdivision: { code: 'JS', name: 'Jamstack' },
  }
  const mockState = {
    get() {},
    set(key, value) {
      hasCalledStateSet = true

      t.is(key, 'geolocation')
      t.deepEqual(value.data, testLocation)
      t.is(typeof value.timestamp, 'number')
    },
  }
  const mockRequest = nock('https://netlifind.netlify.app').get('/').reply(200, {
    geo: testLocation,
  })
  const geo = await getGeoLocation({ mode: 'cache', state: mockState })

  t.true(mockRequest.isDone())
  t.true(hasCalledStateSet)
  t.deepEqual(geo, testLocation)
})

test('`getGeoLocation` returns geolocation data from cache if data is younger than TTL', async (t) => {
  let hasCalledStateSet = false

  const testLocation = {
    city: 'Netlify Town',
    country: { code: 'NF', name: 'Netlify' },
    subdivision: { code: 'JS', name: 'Jamstack' },
  }
  const mockState = {
    get(key) {
      t.is(key, 'geolocation')

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

  t.false(mockRequest.isDone())
  t.false(hasCalledStateSet)
  t.deepEqual(geo, testLocation)
})

test('`getGeoLocation` returns geolocation data from cache, even if older than TTL, if the application is offline', async (t) => {
  let hasCalledStateSet = false

  const testLocation = {
    city: 'Netlify Town',
    country: { code: 'NF', name: 'Netlify' },
    subdivision: { code: 'JS', name: 'Jamstack' },
  }
  const mockState = {
    get(key) {
      t.is(key, 'geolocation')

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

  t.false(mockRequest.isDone())
  t.false(hasCalledStateSet)
  t.deepEqual(geo, testLocation)
})

test('`getGeoLocation` returns mock geolocation data if `mode: "mock"`', async (t) => {
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

  t.false(mockRequest.isDone())
  t.false(hasCalledStateSet)
  t.deepEqual(geo, defaultMockLocation)
})

test('`getGeoLocation` returns mock geolocation data if valid country code set', async (t) => {
  const returnedLocation = {
    city: 'Mock City',
    country: { code: 'CA', name: 'Canada' },
    subdivision: { code: 'SD', name: 'Mock Subdivision' },
  }

  const mockState = {
    get() {},
    set() {},
  }

  const geo = await getGeoLocation({ mode: 'mock', state: mockState, geoCountry: 'CA', geoSubdivision: undefined })

  t.deepEqual(geo, returnedLocation)
})

test('`getGeoLocation` mocks subdivision when passing valid code', async (t) => {
  const mockState = {
    get() {},
    set() {},
  }

  const returnedLocation = {
    city: 'Mock City',
    country: { code: 'AD', name: 'Andorra' },
    subdivision: { code: '07', name: 'Andorra la Vella' },
  }

  const geo = await getGeoLocation({
    mode: 'mock',
    offline: false,
    state: mockState,
    geoCountry: 'AD',
    geoSubdivision: '07',
  })

  t.deepEqual(geo, returnedLocation)
})

test('`getGeoLocation` returns default mock location when passing subdivision without country', async (t) => {
  const mockState = {
    get() {},
    set() {},
  }

  const expectedLocation = {
    city: 'San Francisco',
    country: { code: 'US', name: 'United States' },
    subdivision: { code: 'CA', name: 'California' },
  }

  const geo = await getGeoLocation({
    geoCountry: undefined,
    geoSubdivision: 'NC',
    mode: 'mock',
    offline: false,
    state: mockState,
  })

  t.deepEqual(geo, expectedLocation)
})

test('`getGeoLocation` mocks country with default subdivision with no subdivision flag', async (t) => {
  const mockState = {
    get() {},
    set() {},
  }

  const returnedLocation = {
    city: 'Mock City',
    country: { code: 'MX', name: 'Mexico' },
    subdivision: { code: 'SD', name: 'Mock Subdivision' },
  }

  const geo = await getGeoLocation({
    mode: 'mock',
    offline: false,
    state: mockState,
    geoCountry: 'MX',
    geoSubdivision: '',
  })

  t.deepEqual(geo, returnedLocation)
})

test('`getGeoLocation` mocks country code when not using mock flag', async (t) => {
  const mockState = {
    get() {},
    set() {},
  }

  const returnedLocation = {
    city: 'Mock City',
    country: { code: 'CA', name: 'Canada' },
    subdivision: { code: 'SD', name: 'Mock Subdivision' },
  }

  const geo = await getGeoLocation({
    mode: 'mock',
    offline: false,
    state: mockState,
    geoCountry: 'CA',
    geoSubdivision: '',
  })

  t.deepEqual(geo, returnedLocation)
})
