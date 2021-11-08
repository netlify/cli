const test = require('ava')
const backoff = require('backoff')
const fetch = require('node-fetch')
const sinon = require('sinon')

// eslint-disable-next-line import/order
const openBrowser = require('./open-browser')
// Stub needs to be required before './gh-auth' as this uses the module
/** @type {string} */
let host
const stubbedModule = sinon.stub(openBrowser, 'openBrowser').callsFake(({ url }) => {
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1))
  host = params.get('host')
  return Promise.resolve()
})

// eslint-disable-next-line import/order
const { authWithNetlify } = require('./gh-auth')

test.after(() => {
  stubbedModule.restore()
})

test('should check if the authWithNetlify is working', async (t) => {
  const promise = authWithNetlify()
  // wait for server to be started
  await new Promise((resolve, reject) => {
    const fibonacciBackoff = backoff.fibonacci()
    const check = () => (host ? resolve() : fibonacciBackoff.backoff())
    // eslint-disable-next-line no-magic-numbers
    fibonacciBackoff.failAfter(10)
    fibonacciBackoff.on('ready', check)
    fibonacciBackoff.on('fail', reject)
    check()
  })

  const params = new URLSearchParams([
    ['user', 'spongebob'],
    ['token', 'gho_some-token'],
    ['provider', 'github'],
  ])
  // perform a request like the redirect from the Web ui
  await fetch(new URL(`?${params.toString()}`, host))
  const result = await promise

  t.is(typeof result, 'object')
  t.deepEqual(result, {
    user: 'spongebob',
    token: 'gho_some-token',
    provider: 'github',
  })
})
