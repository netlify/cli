const get = require('lodash.get')
const set = require('lodash.set')
const queryString = require('qs')
const r2 = require('r2')
const camelCase = require('lodash.camelcase')

function existy(val) {
  return val != null
}

exports.methods = require('./shape-swagger')

// open-api 2.0
exports.generateMethod = method => {
  return async function(params, opts) {
    opts = Object.assign({}, opts)
    params = Object.assign({}, this.globalParams, params)

    let path = this.basePath + method.path
    // Path parameters
    Object.values(method.parameters.path).forEach(param => {
      const val = params[param.name] || params[camelCase(param.name)]
      if (existy(val)) {
        path = path.replace(`{${param.name}}`, val)
      } else if (param.required) {
        throw new Error(`Missing required param ${param.name}`)
      }
    })
    // qs parameters
    let qs
    Object.values(method.parameters.query).forEach(param => {
      const val = params[param.name] || params[camelCase(param.name)]
      if (existy(val)) {
        if (!qs) qs = {}
        qs[param.name] = val
      } else if (param.required) {
        throw new Error(`Missing required param ${param.name}`)
      }
    })
    if (qs) path = path += `?${queryString.stringify(qs)}`
    // body parameters
    let body
    let bodyType = 'json'
    if (params.body) {
      body = params.body
      Object.values(method.parameters.body).forEach(param => {
        const type = get(param, 'schema.format')
        if (type === 'binary') {
          bodyType = 'binary'
        }
      })
    }

    const discoveredHeaders = {}
    if (body) {
      switch (bodyType) {
        case 'binary': {
          opts.body = body
          set(discoveredHeaders, 'Content-Type', 'application/octet-stream')
          break
        }
        case 'json':
        default: {
          opts.json = body
          break
        }
      }
    }

    opts.headers = Object.assign({}, this.defaultHeaders, discoveredHeaders, opts.headers)

    const req = await r2[method.verb](path, opts)
    const response = await req.response

    if (response.status >= 400) {
      const err = new Error(response.statusText)
      err.status = response.status
      err.statusText = response.statusText
      err.response = response
      err.path = path
      err.opts = opts
      throw err
    }
    // Put the status on the prototype to prevent it from serializing
    const status = {
      status: response.status,
      statusText: response.statusText
    }

    try {
      const json = await req.json
      // inject prototype props
      Object.setPrototypeOf(status, Object.getPrototypeOf(json))
      Object.setPrototypeOf(json, status)
      return json
    } catch (e) {
      return await req.text
    }
  }
}
