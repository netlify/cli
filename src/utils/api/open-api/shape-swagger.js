const dfn = require('@netlify/open-api')
const { sortParams, mergeParams } = require('./util')
const methods = []

Object.entries(dfn.paths).forEach(([apiPath, verbs]) => {
  const topParams = sortParams(verbs.parameters)
  delete verbs.parameters

  Object.entries(verbs).forEach(([verb, props]) => {
    const verbParams = sortParams(props.parameters)
    delete props.parameters

    const opSpec = Object.assign(
      {},
      props,
      {
        verb,
        path: apiPath
      },
      {
        parameters: mergeParams(topParams, verbParams)
      }
    )
    methods.push(opSpec)
  })
})

module.exports = methods
