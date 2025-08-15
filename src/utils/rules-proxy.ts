import http from 'http'

import chokidar, { type FSWatcher } from 'chokidar'

const watchers: FSWatcher[] = []

export const onChanges = function (files: string[], listener: () => unknown): void {
  files.forEach((file) => {
    const watcher = chokidar.watch(file)
    watcher.on('change', listener)
    watcher.on('unlink', listener)
    watchers.push(watcher)
  })
}

export const getWatchers = function (): FSWatcher[] {
  return watchers
}

export const getLanguage = function (headers: Record<string, string | string[] | undefined>) {
  if (headers['accept-language']) {
    return (
      Array.isArray(headers['accept-language']) ? headers['accept-language'].join(', ') : headers['accept-language']
    )
      .split(',')[0]
      .slice(0, 2)
  }
  return 'en'
}

export const nodeRequestToWebRequest = (req: http.IncomingMessage): globalThis.Request => {
  const protocol = req.socket && 'encrypted' in req.socket && req.socket.encrypted ? 'https' : 'http'
  const host = req.headers.host || 'localhost'
  const url = `${protocol}://${host}${req.url}`
  
  return new globalThis.Request(url, {
    method: req.method || 'GET',
    headers: req.headers as Record<string, string>,
  })
}