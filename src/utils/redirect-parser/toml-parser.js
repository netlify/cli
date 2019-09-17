const TOML = require('@iarna/toml')
const Result = require('./result')
const common = require('./common')

function splatForwardRule(path, obj, dest) {
  return path.match(/\/\*$/) && dest == null && obj.status && obj.status >= 200 && obj.status < 300 && obj.force
}

function isPlainObj(o) {
  return typeof o == 'object' && o.constructor == Object
}

function fetch(obj, options) {
  for (const i in options) {
    if (obj.hasOwnProperty(options[i])) {
      return obj[options[i]]
    }
  }
  return null
}

function redirectMatch(obj) {
  const origin = fetch(obj, ['from', 'origin'])
  const redirect = origin && origin.match(common.FULL_URL_MATCHER) ? common.parseFullOrigin(origin) : { path: origin }
  if (redirect == null || (redirect.path == null && redirect.host == null)) {
    return null
  }

  const dest = fetch(obj, ['to', 'destination'])
  if (splatForwardRule(redirect.path, obj, dest)) {
    redirect.to = redirect.path.replace(/\/\*$/, '/:splat')
  } else {
    redirect.to = dest
  }

  if (redirect.to == null) {
    return null
  }

  redirect.params = fetch(obj, ['query', 'params', 'parameters'])
  redirect.status = fetch(obj, ['status'])
  redirect.force = fetch(obj, ['force'])
  redirect.conditions = fetch(obj, ['conditions'])
  redirect.headers = fetch(obj, ['headers'])
  redirect.signed = fetch(obj, ['sign', 'signing', 'signed'])

  Object.keys(redirect).forEach(key => {
    if (redirect[key] === null) {
      delete redirect[key]
    }
  })

  if (redirect.headers && !isPlainObj(redirect.headers)) {
    return null
  }

  return redirect
}

function parse(source) {
  const result = new Result()
  const config = TOML.parse(source)

  if (!config.redirects) {
    return result
  }

  config.redirects.forEach((obj, idx) => {
    if (!isPlainObj(obj)) {
      result.addError(idx, obj)
      return
    }

    const redirect = redirectMatch(obj)
    if (!redirect) {
      result.addError(idx, JSON.stringify(obj))
      return
    }

    if (common.isInvalidSource(redirect)) {
      result.addError(idx, JSON.stringify(obj), {
        reason: 'Invalid /.netlify path in redirect source'
      })
      return
    }

    if (common.isProxy(redirect)) {
      redirect.proxy = true
    }

    result.addSuccess(redirect)
  })

  return result
}

exports.parse = parse
