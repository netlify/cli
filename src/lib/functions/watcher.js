const { env } = require('process')

const chokidar = require('chokidar')
const decache = require('decache')
const debounce = require('lodash/debounce')
const pEvent = require('p-event')

const DEBOUNCE_WAIT = 100

const debounceWithToggle = (func, ...args) =>
  env.NETLIFY_TEST_DISABLE_DEBOUNCE === 'true' ? func : debounce(func, ...args)

const watchDebounced = async (target, { depth, onAdd, onChange, onUnlink }) => {
  const watcher = chokidar.watch(target, { depth, ignored: /node_modules/, ignoreInitial: true })

  await pEvent(watcher, 'ready')

  const debouncedOnChange = debounceWithToggle((path) => {
    decache(path)

    if (typeof onChange === 'function') {
      onChange(path)
    }
  }, DEBOUNCE_WAIT)
  const debouncedOnUnlink = debounceWithToggle((path) => {
    decache(path)

    if (typeof onUnlink === 'function') {
      onUnlink(path)
    }
  }, DEBOUNCE_WAIT)
  const debouncedOnAdd = debounceWithToggle((path) => {
    decache(path)

    if (typeof onAdd === 'function') {
      onAdd(path)
    }
  }, DEBOUNCE_WAIT)

  watcher.on('change', debouncedOnChange).on('unlink', debouncedOnUnlink).on('add', debouncedOnAdd)

  return watcher
}

module.exports = { watchDebounced }
