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

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'parseRawFl... Remove this comment to see the full error message
const parseRawFlags = function (raw: any) {
  const rawFlags = raw.reduce((acc: any, curr: any, index: any, array: any) => {
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

const aggressiveJSONParse = function (value: any) {
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

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = {
  parseRawFlags,
  aggressiveJSONParse,
}
