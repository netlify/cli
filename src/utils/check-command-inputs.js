// Checks for args or flags supplied to command
const isEmptyCommand = function (flags, args) {
  if (!hasFlags(flags) && !hasArgs(args)) {
    return true
  }
  return false
}

const hasFlags = function (flags) {
  return Object.keys(flags).length
}

const hasArgs = function (args) {
  return Object.keys(args).length
}

module.exports = {
  hasFlags,
  hasArgs,
  isEmptyCommand,
}
