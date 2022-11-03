// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const fs = require('fs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'path'.
const path = require('path')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'process'.
const process = require('process')

// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const dotProp = require('dot-prop')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'findUp'.
const findUp = require('find-up')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const writeFileAtomic = require('write-file-atomic')

// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const { getPathInProject } = require('../lib/settings.cjs')

const STATE_PATH = getPathInProject(['state.json'])
const permissionError = "You don't have access to this file."

// Finds location of `.netlify/state.json`
const findStatePath = (cwd: any) => {
  const statePath = findUp.sync([STATE_PATH], { cwd })

  if (!statePath) {
    return path.join(cwd, STATE_PATH)
  }

  return statePath
}

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'StateConfi... Remove this comment to see the full error message
class StateConfig {
  path: any;
  constructor(cwd: any) {
    this.path = findStatePath(cwd)
  }

  get all() {
    try {
      return JSON.parse(fs.readFileSync(this.path))
    } catch (error) {
      // Don't create if it doesn't exist
      if ((error as any).code === 'ENOENT' || (error as any).code === 'ENOTDIR') {
        return {}
      }

      // Improve the message of permission errors
      if ((error as any).code === 'EACCES') {
        (error as any).message = `${(error as any).message}\n${permissionError}\n`;
      }

      // Empty the file if it encounters invalid JSON
      if ((error as any).name === 'SyntaxError') {
        writeFileAtomic.sync(this.path, '')
        return {}
      }

      throw error
    }
  }

  set all(val) {
    try {
      // Make sure the folder exists as it could have been deleted in the meantime
      fs.mkdirSync(path.dirname(this.path), { recursive: true })
      writeFileAtomic.sync(this.path, JSON.stringify(val, null, '\t'))
    } catch (error) {
      // Improve the message of permission errors
      if ((error as any).code === 'EACCES') {
        (error as any).message = `${(error as any).message}\n${permissionError}\n`;
      }

      throw error
    }
  }

  get size() {
    return Object.keys(this.all || {}).length
  }

  get(key: any) {
    if (key === 'siteId' && process.env.NETLIFY_SITE_ID) {
      // TODO figure out cleaner way of grabbing ENV vars
      return process.env.NETLIFY_SITE_ID
    }
    return dotProp.get(this.all, key)
  }

  set(...args: any[]) {
    const [key, val] = args
    const config = this.all

    if (args.length === 1) {
      // @ts-expect-error TS(2550) FIXME: Property 'entries' does not exist on type 'ObjectC... Remove this comment to see the full error message
      Object.entries(key).forEach(([keyPart, value]) => {
        dotProp.set(config, keyPart, value)
      })
    } else {
      dotProp.set(config, key, val)
    }

    this.all = config
  }

  has(key: any) {
    return dotProp.has(this.all, key)
  }

  delete(key: any) {
    const config = this.all
    dotProp.delete(config, key)
    this.all = config
  }

  clear() {
    this.all = {}
  }
}

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = { StateConfig }
