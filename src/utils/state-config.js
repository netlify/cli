const path = require('path')
const findUp = require('find-up')
const makeDir = require('make-dir')
const fs = require('fs')
const writeFileAtomic = require('write-file-atomic')
const dotProp = require('dot-prop')

const STATE_PATH = path.join('.netlify', 'state.json')
const permissionError = "You don't have access to this file."

class StateConfig {
  constructor(cwd) {
    this.path = this.findStatePath(cwd)
  }

  // Finds location of `.netlify/state.json`
  findStatePath(cwd) {
    const statePath = findUp.sync([STATE_PATH], { cwd })

    if (!statePath) {
      return path.join(cwd, STATE_PATH)
    }

    return statePath
  }

  get all() {
    try {
      return JSON.parse(fs.readFileSync(this.path, 'utf8'))
    } catch (err) {
      // Don't create if it doesn't exist
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
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
    if (key === 'siteId' && process.env.NETLIFY_SITE_ID) {
      // TODO figure out cleaner way of grabbing ENV vars
      return process.env.NETLIFY_SITE_ID
    }
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

module.exports = StateConfig
