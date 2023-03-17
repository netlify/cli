import { basename, extname } from 'path'

/**
 * @param {string} staticFile
 *
 * @returns {string}
 */
const getCanonicalURLPath = (staticFile) => {
  const base = basename(staticFile)

  if (base === 'index.html' || base === 'index.htm') {
    return staticFile.slice(0, -base.length)
  }

  const ext = extname(staticFile)

  if (ext === '.html' || ext === '.htm') {
    return staticFile.slice(0, -ext.length)
  }

  return staticFile
}

export default getCanonicalURLPath
