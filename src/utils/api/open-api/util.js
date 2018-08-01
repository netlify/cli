const set = require('lodash.set')

exports.sortParams = (parameters = []) => {
  const paramSet = {
    // minimum param set
    path: {},
    query: {},
    body: {}
  }

  parameters.forEach(param => {
    set(paramSet, `${param.in}.${param.name}`, param)
  })

  return paramSet
}

exports.mergeParams = (...params) => {
  const merged = {}

  params.forEach(paramSet => {
    Object.entries(paramSet).forEach(([type, params]) => {
      if (!merged[type]) merged[type] = {} // preserve empty objects
      Object.values(params).forEach((param, index) => {
        set(merged, `${param.in}.${param.name}`, Object.assign(param, { index }))
      })
    })
  })

  return merged
}
