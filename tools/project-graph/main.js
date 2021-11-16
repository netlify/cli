// @ts-check
const { existsSync, readFileSync } = require('fs')
const { dirname, join, parse, resolve } = require('path')
const { inspect } = require('util')

const ts = require('typescript')

const { parseDependencies } = require('./parse-dependencies')

/** @type {import('./types').visitorPlugin[]} */
const visitorPlugins = [
  function (node, state) {
    if (ts.isSourceFile(node)) {

      console.log(state)
    }
  }
]

const dependencies = parseDependencies('tests/command.dev.test.js', visitorPlugins)
console.log(inspect(dependencies, false, 10, true))
