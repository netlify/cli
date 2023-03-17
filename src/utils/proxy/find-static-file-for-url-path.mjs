import { relative, resolve } from 'path'

import { locatePath } from 'locate-path'

import alternativePathsFor from './alternative-paths-for.mjs'

/**
 * Tries to find an existing static file in `publicFolder` that the `pathname`
 * is referring to
 *
 * @param {string} pathname
 * @param {string} publicFolder
 * @returns {Promise<string | undefined>}
 */
const findStaticFileForURLPath = async function (pathname, publicFolder) {
  const alternatives = [pathname, ...alternativePathsFor(pathname)].map((filePath) =>
    resolve(publicFolder, filePath.slice(1)),
  )

  const file = await locatePath(alternatives)
  if (file === undefined) {
    return
  }

  return `/${relative(publicFolder, file)}`
}

export default findStaticFileForURLPath
