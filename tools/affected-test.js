#!/usr/bin/env node
// @ts-check
const { existsSync, statSync } = require('fs')
const { join } = require('path')
const process = require('process')

const { grey } = require('chalk')
const execa = require('execa')
const { sync } = require('fast-glob')

const { ava } = require('../package.json')

const { DependencyGraph, fileVisitor, visitorPlugins } = require('./project-graph')

const getChangedFiles = async (compareTarget = 'origin/main') => {
  const { stdout } = await execa('git', ['diff', '--name-only', 'HEAD', compareTarget])
  // git is using posix paths so adjust them to the operating system by
  // using nodes join function
  return stdout.split('\n').map((filePath) => join(filePath))
}

/**
 * Get the list of affected files - if some files are touched like the package.json
 * everything is affected.
 * @param {string[]} changedFiles
 * @returns {string[]}
 */
const getAffectedFiles = (changedFiles) => {
  // glob is using only posix file paths on windows we need the `\`
  // by using join the paths are adjusted to the operating system
  const testFiles = sync(ava.files).map((filePath) => join(filePath))

  // in this case all files are affected
  if (changedFiles.includes('npm-shrinkwrap.json') || changedFiles.includes('package.json')) {
    console.log('All files are affected based on the changeset')
    return testFiles
  }

  const graph = new DependencyGraph()

  testFiles.forEach((file) => {
    fileVisitor(file, { graph, visitorPlugins })
  })

  return [...graph.affected(changedFiles, (file) => file.endsWith('.test.js'))]
}

/**
 * The main function
 * @param {string[]} args
 */
const main = async (args) => {
  const changedFiles =
    args[0] && existsSync(args[0])
      ? args.filter((arg) => existsSync(arg) && statSync(arg).isFile())
      : await getChangedFiles(args[0])

  const affectedFiles = getAffectedFiles(changedFiles)

  if (affectedFiles.length === 0) {
    console.log('No files where affected by the changeset!')
    return
  }
  console.log(`Running affected Tests: \n${grey([...affectedFiles].join(', '))}`)
  const testRun = execa('c8', ['-r', 'json', 'ava', ...affectedFiles], {
    stdio: 'inherit',
    preferLocal: true,
  })

  process.on('exit', () => {
    testRun.kill()
  })

  try {
    await testRun
  } catch (error) {
    if (error instanceof Error) {
      console.log(error.message)
      process.exit(1)
    }
    throw error
  }
}

// Can be invoked with two different arguments:
// Either a list of files where all affected tests should be calculated based on:
// $ npm run test:affected -- ./path/to/file.js ./other-file.js
//
// or by specifying a git diff target
// $ npm run test:affected -- HEAD~1
//
// The default is when running without arguments a git diff target off 'origin/master'
if (require.main === module) {
  const args = process.argv.slice(2)
  // eslint-disable-next-line promise/prefer-await-to-callbacks,promise/prefer-await-to-then
  main(args).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

module.exports = { getChangedFiles, getAffectedFiles }
