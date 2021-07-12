const { env } = require('process')

const MEMOIZATION_DEBOUNCE_INTERVAL = 300

const debounce = require('lodash/debounce')

const debounceWithToggle = (func, ...args) =>
  env.NETLIFY_TEST_DISABLE_DEBOUNCE === 'true' ? func : debounce(func, ...args)

const getMemoizationInterval = () => (env.NETLIFY_TEST_DISABLE_DEBOUNCE === 'true' ? 0 : MEMOIZATION_DEBOUNCE_INTERVAL)

module.exports = { debounce: debounceWithToggle, getMemoizationInterval }
