const got = require('got')

const STATUS_CODE_LIMIT_OK = 299
const STATUS_CODE_LIMIT_REDIRECT = 399

const isResponseOk = (response) => {
  const { statusCode } = response
  const limitStatusCode = response.request.options.followRedirect ? STATUS_CODE_LIMIT_OK : STATUS_CODE_LIMIT_REDIRECT

  return (statusCode >= 200 && statusCode <= limitStatusCode) || statusCode === 304
}

const TIMEOUT = 3e5

// Default got retry status code with the addition of 403
// eslint-disable-next-line no-magic-numbers
const STATUS_CODE = [403, 408, 413, 429, 500, 502, 503, 504, 521, 522, 524]

const extendedGot = got.extend({
  retry: {
    statusCodes: STATUS_CODE,
  },
  timeout: TIMEOUT,
  // TODO: remove when https://github.com/sindresorhus/got/issues/1489 is fixed
  // see https://github.com/sindresorhus/got/issues/1489#issuecomment-805485731
  hooks: {
    afterResponse: [
      (response) => {
        if (isResponseOk(response)) {
          response.request.destroy()
        }

        return response
      },
    ],
  },
})

module.exports = extendedGot
