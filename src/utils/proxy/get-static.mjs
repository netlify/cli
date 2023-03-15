import { relative, resolve } from 'path'

import { locatePath } from 'locate-path'

import alternativePathsFor from './alternative-paths-for.mjs'

/**
 *
 * @param {string} pathname
 * @param {string} publicFolder
 * @returns {Promise<string | undefined>}
 */
const getStatic = async function (pathname, publicFolder) {
  const alternatives = [pathname, ...alternativePathsFor(pathname)].map((filePath) =>
    resolve(publicFolder, filePath.slice(1)),
  )

  const file = await locatePath(alternatives)
  if (file === undefined) {
    return
  }

  return `/${relative(publicFolder, file)}`
}

export default getStatic
