// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fs'.
const fs = require('fs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'path'.
const path = require('path')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'process'.
const process = require('process')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'dotProp'.
const dotProp = require('dot-prop')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'findUp'.
const findUp = require('find-up')
const writeFileAtomic = require('write-file-atomic')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getPathInP... Remove this comment to see the full error message
const { getPathInProject } = require('../lib/settings.cjs')

const STATE_PATH = getPathInProject(['state.json'])
const permissionError = "You don't have access to this file."

// Finds location of `.netlify/state.json`
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const findStatePath = (cwd: $TSFixMe) => {
  const statePath = findUp.sync([STATE_PATH], { cwd })

  if (!statePath) {
    return path.join(cwd, STATE_PATH)
  }

  return statePath
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'StateConfi... Remove this comment to see the full error message
class StateConfig {
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  path: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  constructor(cwd: $TSFixMe) {
    this.path = findStatePath(cwd)
  }

  get all() {
    try {
      return JSON.parse(fs.readFileSync(this.path))
    } catch (error) {
      // Don't create if it doesn't exist
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      if ((error as $TSFixMe).code === 'ENOENT' || (error as $TSFixMe).code === 'ENOTDIR') {
        return {}
      }

      // Improve the message of permission errors
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      if ((error as $TSFixMe).code === 'EACCES') {
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        (error as $TSFixMe).message = `${(error as $TSFixMe).message}\n${permissionError}\n`;
      }

      // Empty the file if it encounters invalid JSON
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      if ((error as $TSFixMe).name === 'SyntaxError') {
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
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      if ((error as $TSFixMe).code === 'EACCES') {
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        (error as $TSFixMe).message = `${(error as $TSFixMe).message}\n${permissionError}\n`;
      }

      throw error
    }
  }

  get size() {
    return Object.keys(this.all || {}).length
  }

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  get(key: $TSFixMe) {
    if (key === 'siteId' && process.env.NETLIFY_SITE_ID) {
      // TODO figure out cleaner way of grabbing ENV vars
      return process.env.NETLIFY_SITE_ID
    }
    return dotProp.get(this.all, key)
  }

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  set(...args: $TSFixMe[]) {
    const [key, val] = args
    const config = this.all

    if (args.length === 1) {
      Object.entries(key).forEach(([keyPart, value]) => {
        dotProp.set(config, keyPart, value)
      })
    } else {
      dotProp.set(config, key, val)
    }

    this.all = config
  }

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  has(key: $TSFixMe) {
    return dotProp.has(this.all, key)
  }

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  delete(key: $TSFixMe) {
    const config = this.all
    dotProp.delete(config, key)
    this.all = config
  }

  clear() {
    this.all = {}
  }
}

module.exports = { StateConfig }
