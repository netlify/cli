const test = require('ava')
const nock = require('nock')

const { getGeoLocation, mockLocation } = require('../../../src/lib/geo-location')

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
  t.deepEqual(geo, mockLocation)
})
