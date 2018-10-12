const fs = require('fs')
const TOML = require('@iarna/toml')
const permissionError = "You don't have access to this file."

module.exports = function getConfigData(configPath) {
  // No config value. probably not in folder
  if (!configPath) {
    return {}
  }

  try {
    // TODO support more formats
    return TOML.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (err) {
    // Don't create if it doesn't exist
    if (err.code === 'ENOENT') {
      return {}
    }

    // Improve the message of permission errors
    if (err.code === 'EACCES') {
      err.message = `${err.message}\n${permissionError}\n`
    }

    throw err
  }
}
