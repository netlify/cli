const got = require('got')

const TIMEOUT = 3e5

// Default got retry status code with the addition of 403
const STATUS_CODE = [403, 408, 413, 429, 500, 502, 503, 504, 521, 522, 524]

const extendedGot = got.extend({
  retry: {
    statusCodes: STATUS_CODE,
  },
  timeout: TIMEOUT,
})

module.exports = extendedGot
