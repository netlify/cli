const validateEmail = (ctx, str) => {
  if (typeof str !== 'string' && !(str instanceof String)) {
    throw new TypeError(`${ctx} must be a string`)
  }

  validateLength(ctx, str, EMAIL_MIN_LENGTH, EMAIL_MAX_LENGTH)

  if (!/^[\w.-]+@[\w.-]+\.\w+$/.test(str)) {
    throw new TypeError(`${ctx} is not an email address`)
  }
}

const EMAIL_MIN_LENGTH = 5
const EMAIL_MAX_LENGTH = 30

const validateLength = (ctx, str, min, max) => {
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

module.exports = {
  validateEmail,
  validateLength,
}
