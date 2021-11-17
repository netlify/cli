#!/usr/bin/env node
const { existsSync, statSync } = require('fs')
const process = require('process')

const execa = require('execa')
const { sync } = require('fast-glob')

const { ava } = require('../package.json')

const { DependencyGraph, fileVisitor, visitorPlugins } = require('./project-graph')

const getChangedFiles = async (compareTarget = 'origin/main') => {
  const { stdout } = await execa('git', ['diff', '--name-only', 'HEAD', compareTarget])
  return stdout.split('\n')
}

/**
 * The main functions
 * @param {yargs.Arguments} args
 */
const main = async (args) => {
  const graph = new DependencyGraph()

  const changedFiles =
    args[0] && existsSync(args[0])
      ? args.filter((arg) => existsSync(arg) && statSync(arg).isFile())
      : await getChangedFiles(args[0])

  // TODO add condition for ;npm-shrinkwrap.json

  sync(ava.files).forEach((file) => {
    fileVisitor(file, { graph, visitorPlugins })
  })

  const affectedFiles = graph.affected(changedFiles, (file) => file.endsWith('.test.js'))

  console.log(affectedFiles)
}

if (require.main === module) {
  const args = process.argv.slice(2)
  // eslint-disable-next-line promise/prefer-await-to-then
  main(args).catch(console.error)
}

module.exports = { getChangedFiles }
