const chalk = require('chalk')

/**
 * Chalk instance for CLI
 * @param  {boolean} noColors - disable chalk colors
 * @return {object} - chalk instance or proxy noOp
 */
const safeChalk = function (noColors) {
  /* if no colors return proxy to chalk API */
  if (noColors) {
    return neverNull(chalk)
  }
  return chalk
}

const noop = function () {}

const neverNull = function (obj) {
  const match = function (some, none = noop) {
    return obj == null ? none() : some(obj)
  }
  return new Proxy(
    (some, none) => {
      if (some) {
        // has value return it with no chalk wrapper
        return some
      }
      if (!some && !none) return obj
      return match(some, none)
    },
    {
      get: (target, key) => {
        const targetObj = target()
        if (targetObj !== null && typeof targetObj === 'object') {
          return neverNull(targetObj[key])
        }
        return neverNull()
      },
      set: (target, key, val) => {
        const targetObj = target()
        if (targetObj !== null && typeof targetObj === 'object') {
          targetObj[key] = val
        }
        return true
      },
    },
  )
}

module.exports = safeChalk
