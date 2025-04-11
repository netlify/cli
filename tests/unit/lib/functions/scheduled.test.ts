import { expect, describe, test } from 'vitest'

import { buildHelpResponse } from '../../../../src/lib/functions/scheduled.js'
import { CLOCKWORK_USERAGENT } from '../../../../src/utils/functions/constants.js'

const withAccept = (accept: string) =>
  buildHelpResponse({
    error: null,
    headers: {
      accept,
    },
    path: '/',
    result: {
      statusCode: 200,
    },
  })

const withUserAgent = (userAgent: string) =>
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

describe('buildHelpResponse', () => {
  test('buildHelpResponse does content negotiation', () => {
    const html = withAccept('text/html')
    expect(html.contentType).toBe('text/html')
    expect(html.message).toContain('<link rel=')
    expect(html.message).toContain('<p>')

    const plain = withAccept('text/plain')
    expect(plain.contentType).toBe('text/plain')
    expect(plain.message).not.toContain('<link rel=')
    expect(plain.message).not.toContain('<p>')
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

    expect(response.message).toContain('There was an error')
  })

  test('buildHelpResponse conditionally prints notice about HTTP x scheduled functions', () => {
    expect(withUserAgent('').message).toContain("it won't work in production")
    expect(withUserAgent(CLOCKWORK_USERAGENT).message).not.toContain("it won't work in production")
  })
})
