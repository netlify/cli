import got from 'got'

const TIMEOUT = 300_000

// Default got retry status code with the addition of 403
const STATUS_CODE = [403, 408, 413, 429, 500, 502, 503, 504, 521, 522, 524]

export const extendedGot = got.extend({
  retry: {
    statusCodes: STATUS_CODE,
  },
  timeout: { request: TIMEOUT },
})
