exports.validateEmail = (ctx, str) => {
  if (typeof str !== 'string' && !(str instanceof String)) {
    throw new TypeError(`${ctx} must be a string`)
  }

  exports.validateLength(ctx, str, 5, 30)

  if (!/^[\w.-]+@[\w.-]+\.\w+$/.test(str)) {
    throw new TypeError(`${ctx} is not an email address`)
  }
}

exports.validateLength = (ctx, str, min, max) => {
  if (max === undefined) {
    max = min
    min = 0
  }

  if (typeof str !== 'string' && !(str instanceof String)) {
    throw new TypeError(`${ctx} must be a string`)
  }

  if (str.length < min) {
    throw new TypeError(`${ctx} must be at least ${min} chars long`)
  }

  if (str.length > max) {
    throw new TypeError(`${ctx} must contain ${max} chars at most`)
  }
}
