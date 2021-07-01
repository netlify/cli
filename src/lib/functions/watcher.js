const chokidar = require('chokidar')
const decache = require('decache')
const debounce = require('lodash/debounce')
const pEvent = require('p-event')

const DEBOUNCE_WAIT = 300

const watchDebounced = async (target, { depth, onAdd, onChange, onUnlink }) => {
  const watcher = chokidar.watch(target, { depth, ignored: /node_modules/, ignoreInitial: true })
  const debounceOptions = {
    leading: false,
    trailing: true,
  }

  await pEvent(watcher, 'ready')

  const debouncedOnChange = debounce(
    (path) => {
      decache(path)

      if (typeof onChange === 'function') {
        onChange(path)
      }
    },
    DEBOUNCE_WAIT,
    debounceOptions,
  )
  const debouncedOnUnlink = debounce(
    (path) => {
      decache(path)

      if (typeof onUnlink === 'function') {
        onUnlink(path)
      }
    },
    DEBOUNCE_WAIT,
    debounceOptions,
  )
  const debouncedOnAdd = debounce(
    (path) => {
      decache(path)

      if (typeof onAdd === 'function') {
        onAdd(path)
      }
    },
    DEBOUNCE_WAIT,
    debounceOptions,
  )

  watcher.on('change', debouncedOnChange).on('unlink', debouncedOnUnlink).on('add', debouncedOnAdd)

  return watcher
}

module.exports = { watchDebounced }
