#!/usr/bin/env node
// @ts-check
import { existsSync, statSync } from 'fs'
import process, { on, exit, argv } from 'process'
import { fileURLToPath } from 'url'
import { join } from 'path'

import chalk from 'chalk'
import { execa } from 'execa'
import { sync } from 'fast-glob'

import { ava } from '../package.json'

import { DependencyGraph, fileVisitor, visitorPlugins } from './project-graph/index.js'

export const getChangedFiles = async (compareTarget = 'origin/main') => {
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
export const getAffectedFiles = (changedFiles) => {
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
  console.log(`Running affected Tests: \n${chalk.grey([...affectedFiles].join(', '))}`)
  const testRun = execa('c8', ['-r', 'json', 'ava', ...affectedFiles], {
    stdio: 'inherit',
    preferLocal: true,
  })

  on('exit', () => {
    testRun.kill()
  })

  try {
    await testRun
  } catch (error) {
    if (error instanceof Error) {
      console.log(error.message)
      exit(1)
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
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = argv.slice(2)
  // eslint-disable-next-line promise/prefer-await-to-callbacks,promise/prefer-await-to-then
  main(args).catch((error) => {
    console.error(error)
    exit(1)
  })
}
