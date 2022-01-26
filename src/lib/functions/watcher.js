// @ts-check
import chokidar from 'chokidar'
import decache from 'decache'
import { debounce } from 'lodash-es'
import pEvent from 'p-event'

const DEBOUNCE_WAIT = 100

export const watchDebounced = async (target, { depth, onAdd = () => {}, onChange = () => {}, onUnlink = () => {} }) => {
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
