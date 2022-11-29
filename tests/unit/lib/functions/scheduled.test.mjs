import test from 'ava'

import { buildHelpResponse } from '../../../../src/lib/functions/scheduled.mjs'

const withAccept = (accept) =>
  buildHelpResponse({
    error: undefined,
    headers: {
      accept,
    },
    path: '/',
    result: {
      statusCode: 200,
    },
  })

test('buildHelpResponse does content negotiation', (t) => {
  const html = withAccept('text/html')
  t.is(html.contentType, 'text/html')
  t.true(html.message.includes('<link rel='))
  t.true(html.message.includes('<p>'))

  const plain = withAccept('text/plain')
  t.is(plain.contentType, 'text/plain')
  t.false(plain.message.includes('<link rel='))
  t.false(plain.message.includes('<p>'))
})

test('buildHelpResponse prints errors', (t) => {
  const response = buildHelpResponse({
    error: new Error('test'),
    headers: {},
    path: '/',
    result: {
      statusCode: 200,
    },
  })

  t.true(response.message.includes('There was an error'))
})

const withUserAgent = (userAgent) =>
  buildHelpResponse({
    error: new Error('test'),
    headers: {
      accept: 'text/plain',
      'user-agent': userAgent,
    },
    path: '/',
    result: {
      statusCode: 200,
    },
  })

test('buildHelpResponse conditionally prints notice about HTTP x scheduled functions', (t) => {
  t.true(withUserAgent('').message.includes("it won't work in production"))
  t.false(withUserAgent('Netlify Clockwork').message.includes("it won't work in production"))
})
