const { env } = require('process')

const debounce = require('lodash/debounce')

const debounceWithToggle = (func, ...args) =>
  env.NETLIFY_TEST_DISABLE_DEBOUNCE === 'true' ? func : debounce(func, ...args)

module.exports = { debounce: debounceWithToggle }
