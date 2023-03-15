const FUNCTION_PATH_REGEX = /^\/.netlify\/(functions|builders)\/.+/

/**
 * Is the URL a function url
 *
 * @param {number | undefined} functionsPort
 * @param {string} url
 * @returns {boolean}
 */
const isFunction = (functionsPort, url) => Boolean(functionsPort && FUNCTION_PATH_REGEX.test(url))

export default isFunction
