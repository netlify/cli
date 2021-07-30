const { env } = require('process')

// This is a thin layer on top of `execa` that allows consumers to provide an
// alternative path to the module location, making it easier to mock its logic
// in tests (see `tests/utils/mock-execa.js`).
// eslint-disable-next-line import/no-dynamic-require
const execa = require(env.NETLIFY_CLI_EXECA_PATH || 'execa')

module.exports = execa
