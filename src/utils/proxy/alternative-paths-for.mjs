import isFunction from './is-function.mjs'

// Used as an optimization to avoid dual lookups for missing assets
const assetExtensionRegExp = /\.(html?|png|jpg|js|css|svg|gif|ico|woff|woff2)$/

/**
 * For an URL get all possible static file paths that the URL could refer to
 *
 * /foo/ -> /foo/index.html, /foo/index.htm, /foo.html, /foo.htm
 *
 * @param {string} url
 *
 * @returns {string[]}
 */
const alternativePathsFor = function (url) {
  if (isFunction(true, url)) {
    return []
  }

  const paths = []
  if (url[url.length - 1] === '/') {
    const end = url.length - 1
    const urlWithoutSlash = url.slice(0, end)
    if (url !== '/') {
      paths.push(`${urlWithoutSlash}.html`, `${urlWithoutSlash}.htm`)
    }
    paths.push(`${url}index.html`, `${url}index.htm`)
  } else if (!assetExtensionRegExp.test(url)) {
    paths.push(`${url}.html`, `${url}.htm`, `${url}/index.html`, `${url}/index.htm`)
  }

  return paths
}

export default alternativePathsFor
