// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'env'.
const { env } = require('process')

// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const execaLib = require('execa')

// This is a thin layer on top of `execa` that allows consumers to provide an
// alternative path to the module location, making it easier to mock its logic
// in tests (see `tests/utils/mock-execa.js`).

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'execa'.
// eslint-disable-next-line import/no-dynamic-require
const execa = env.NETLIFY_CLI_EXECA_PATH ? require(env.NETLIFY_CLI_EXECA_PATH) : execaLib

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = execa
