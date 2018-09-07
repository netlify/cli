const path = require('path')
const fs = require('fs')
const dotProp = require('dot-prop')
const TOML = require('@iarna/toml')
const permissionError = "You don't have access to this file."

function siteConfig(root, state) {
  const configPath = getConfigPath(root)

  const config = {
    root: root,
    configPath: configPath,
    config: getConfigData(configPath),
    get: (key) => {
      if (key === 'siteId' || key === 'id') {
        // Get ID from state
        return state.get('siteId')
      }
      const currentConfig = siteConfig(root, state)
      return dotProp.get(currentConfig, key)
    },
    // TODO set Set will need AST parser for yml support
  }

  return config
}

function getConfigData(configPath) {
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

function getConfigPath(root) {
  // TODO support more formats
  const tomlPath = path.join(root, 'netlify.toml')

  if (fileExistsSync(tomlPath)) {
    return tomlPath
  }

  return undefined
}

function fileExistsSync(filePath) {
  try {
    const stats = fs.lstatSync(filePath)
    return stats.isFile()
  } catch (e) {
    return false
  }
}

module.exports = siteConfig
