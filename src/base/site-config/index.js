const findUp = require('find-up')
const path = require('path')
const makeDir = require('make-dir')
const fs = require('fs')
const writeFileAtomic = require('write-file-atomic')
const dotProp = require('dot-prop')
const TOML = require('@iarna/toml')

const permissionError = "You don't have access to this file."

class SiteConfig {
  constructor(projectDir, opts) {
    opts = Object.assign(
      {
        rootIndicators: ['.netlify', 'netlify.toml', '.git']
      },
      opts
    )
    const configPath = path.join('.netlify', 'config.json')
    const rootIndicator = findUp.sync(opts.rootIndicators, { cwd: projectDir })
    if (rootIndicator) {
      const root = path.dirname(rootIndicator)
      this.root = root
      this.path = path.join(root, configPath)
    } else {
      this.root = projectDir
      this.path = path.join(projectDir, configPath)
    }
  }

  get toml() {
    try {
      return TOML.parse(fs.readFileSync(path.join(this.root, 'netlify.toml'), 'utf8'))
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

  get tomlPath() {
    const p = path.join(this.root, 'netlify.toml')
    try {
      fs.readFileSync(path.join(this.root, 'netlify.toml'), 'utf8')
      return p
    } catch (_) {
      return undefined
    }
  }

  get all() {
    try {
      return JSON.parse(fs.readFileSync(this.path, 'utf8'))
    } catch (err) {
      // Don't create if it doesn't exist
      if (err.code === 'ENOENT') {
        return {}
      }

      // Improve the message of permission errors
      if (err.code === 'EACCES') {
        err.message = `${err.message}\n${permissionError}\n`
      }

      // Empty the file if it encounters invalid JSON
      if (err.name === 'SyntaxError') {
        writeFileAtomic.sync(this.path, '')
        return {}
      }

      throw err
    }
  }

  set all(val) {
    try {
      // Make sure the folder exists as it could have been deleted in the meantime
      makeDir.sync(path.dirname(this.path))
      writeFileAtomic.sync(this.path, JSON.stringify(val, null, '\t'))
    } catch (err) {
      // Improve the message of permission errors
      if (err.code === 'EACCES') {
        err.message = `${err.message}\n${permissionError}\n`
      }

      throw err
    }
  }

  get size() {
    return Object.keys(this.all || {}).length
  }

  get(key) {
    return dotProp.get(this.all, key)
  }
  set(key, val) {
    const config = this.all

    if (arguments.length === 1) {
      for (const k of Object.keys(key)) {
        dotProp.set(config, k, key[k])
      }
    } else {
      dotProp.set(config, key, val)
    }

    this.all = config
  }

  has(key) {
    return dotProp.has(this.all, key)
  }
  delete(key) {
    const config = this.all
    dotProp.delete(config, key)
    this.all = config
  }
  clear() {
    this.all = {}
  }
}

module.exports = SiteConfig
