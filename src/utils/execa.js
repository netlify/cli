const { env } = require('process')

const execaLib = require('execa')

// This is a thin layer on top of `execa` that allows consumers to provide an
// alternative path to the module location, making it easier to mock its logic
// in tests (see `tests/utils/mock-execa.js`).

// eslint-disable-next-line import/no-dynamic-require
const execa = env.NETLIFY_CLI_EXECA_PATH ? require(env.NETLIFY_CLI_EXECA_PATH) : execaLib

module.exports = execa
