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
    if (/^-{1,2}/.test(curr)) {
      const key = curr.replace(/^-{1,2}/, '')
      const next = array[index + 1]
      if (!next) {
        acc[key] = true
      } else if (/^-{1,2}/.test(next)) {
        acc[key] = true
      } else {
        acc[key] = next ? aggressiveJSONParse(next) : true
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
  } catch {
    try {
      parsed = JSON.parse(`"${value}"`)
    } catch {
      parsed = value
    }
  }
  return parsed
}

module.exports = {
  parseRawFlags,
  aggressiveJSONParse,
}
