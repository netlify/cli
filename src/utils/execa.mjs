import { env } from 'process'
// This is a thin layer on top of `execa` that allows consumers to provide an
// alternative path to the module location, making it easier to mock its logic
// in tests (see `tests/utils/mock-execa.js`).

/**
 * @type {import('execa')}
 */
// eslint-disable-next-line import/no-mutable-exports
let execa

if (env.NETLIFY_CLI_EXECA_PATH) {
  const execaMock = await import(env.NETLIFY_CLI_EXECA_PATH)
  execa = execaMock.default
} else {
  const execaLib = await import('execa')
  execa = execaLib.default
}

export default execa
