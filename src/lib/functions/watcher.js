// @ts-check
const chokidar = require('chokidar')
const decache = require('decache')
const debounce = require('lodash/debounce')
const pEvent = require('p-event')

const DEBOUNCE_WAIT = 100

const watchDebounced = async (target, { depth, onAdd = () => {}, onChange = () => {}, onUnlink = () => {} }) => {
  const watcher = chokidar.watch(target, { depth, ignored: /node_modules/, ignoreInitial: true })

  await pEvent(watcher, 'ready')

  const debouncedOnChange = debounce(onChange, DEBOUNCE_WAIT)
  const debouncedOnUnlink = debounce(onUnlink, DEBOUNCE_WAIT)
  const debouncedOnAdd = debounce(onAdd, DEBOUNCE_WAIT)

  watcher
    .on('change', (path) => {
      decache(path)
      debouncedOnChange(path)
    })
    .on('unlink', (path) => {
      decache(path)
      debouncedOnUnlink(path)
    })
    .on('add', (path) => {
      decache(path)
      debouncedOnAdd(path)
    })

  return watcher
}

module.exports = { watchDebounced }
