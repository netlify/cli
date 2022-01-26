import { execa as execaLib } from 'execa'

// This is a thin layer on top of `execa` that allows consumers to provide an
// alternative path to the module location, making it easier to mock its logic
// in tests (see `tests/utils/mock-execa.js`).

// TODO: does not work either!
// const execa = env.NETLIFY_CLI_EXECA_PATH ? require(env.NETLIFY_CLI_EXECA_PATH) : execaLib
/** @deprecated */
const execa = execaLib

export default execa
