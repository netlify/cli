// Checks for args or flags supplied to command
function isEmptyCommand(flags, args) {
  if (!hasFlags(flags) && !hasArgs(args)) {
    return true
  }
  return false
}

function hasFlags(flags) {
  return Object.keys(flags).length
}

function hasArgs(args) {
  return Object.keys(args).length
}

module.exports = {
  hasFlags: hasFlags,
  hasArgs: hasArgs,
  isEmptyCommand: isEmptyCommand
}
