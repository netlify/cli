// Get flags from `raw` data
//
// Needed for commands using Command.strict = false
//

// Usage:
// const { flags, raw } = this.parse(addonsCreateCommand)
// // flags = {}
// const rawFlags = parseRawFlags(raw)
// // rawFlags = {stuff: yay!}
//

const parseRawFlags = function (raw) {
  const rawFlags = raw.reduce((acc, curr, index, array) => {
    if (curr.input.match(/^-{1,2}/)) {
      const key = curr.input.replace(/^-{1,2}/, '')
      const next = array[index + 1]
      if (!next) {
        acc[key] = true
      } else if (next && next.input && next.input.match(/^-{1,2}/)) {
        acc[key] = true
      } else {
        acc[key] = next ? aggressiveJSONParse(next.input) : true
      }
    }
    return acc
  }, {})
  return rawFlags
}

const aggressiveJSONParse = function (value) {
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  let parsed
  try {
    parsed = JSON.parse(value)
  } catch (error) {
    try {
      parsed = JSON.parse(`"${value}"`)
    } catch (error_) {
      parsed = value
    }
  }
  return parsed
}

module.exports = {
  parseRawFlags,
  aggressiveJSONParse,
}
