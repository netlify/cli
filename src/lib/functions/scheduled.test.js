const { buildHelpResponse } = require('./scheduled')

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

test('buildHelpResponse does content negotiation', () => {
  const html = withAccept('text/html')
  expect(html.contentType).toBe('text/html')
  expect(html.message.includes('<link rel=')).toBe(true)
  expect(html.message.includes('<p>')).toBe(true)

  const plain = withAccept('text/plain')
  expect(plain.contentType).toBe('text/plain')
  expect(plain.message.includes('<link rel=')).toBe(false)
  expect(plain.message.includes('<p>')).toBe(false)
})

test('buildHelpResponse prints errors', () => {
  const response = buildHelpResponse({
    error: new Error('test'),
    headers: {},
    path: '/',
    result: {
      statusCode: 200,
    },
  })

  expect(response.message.includes('There was an error')).toBe(true)
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

test('buildHelpResponse conditionally prints notice about HTTP x scheduled functions', () => {
  expect(withUserAgent('').message.includes("it won't work in production")).toBe(true)
  expect(withUserAgent('Netlify Clockwork').message.includes("it won't work in production")).toBe(false)
})
