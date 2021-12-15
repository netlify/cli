#!/usr/bin/env node
// @ts-check

// This script is run by the completion (every log output will be displayed on tab)
// src/commands/completion/completion.js -> dynamically references this file
// if this file is renamed or moved then it needs to be adapted there
const { existsSync, readFileSync } = require('fs')
const process = require('process')

const { log, parseEnv } = require('tabtab')

const { AUTOCOMPLETION_FILE } = require('./constants')

/**
 * @typedef CompletionItem
 * @type import('tabtab').CompletionItem
 */
/**
 *
 * @param {import('tabtab').TabtabEnv} env
 * @param {Record<string, CompletionItem & {options: CompletionItem[]}>} program
 * @returns {CompletionItem[]|void}
 */
const getAutocompletion = function (env, program) {
  if (!env.complete) {
    return
  }
  // means that we are currently in the first command (the root command)
  if (env.words === 1) {
    const rootCommands = Object.values(program).map(({ description, name }) => ({ name, description }))

    // suggest all commands
    // $ netlify <cursor>
    if (env.lastPartial.length === 0) {
      return rootCommands
    }

    // $ netlify add<cursor>
    // we can now check if a command starts with the last partial
    const autocomplete = rootCommands.filter(({ name }) => name.startsWith(env.lastPartial))
    return autocomplete
  }

  const [, command, ...args] = env.line.split(' ')

  if (program[command]) {
    const usedArgs = new Set(args)
    const unusedOptions = program[command].options.filter(({ name }) => !usedArgs.has(name))

    if (env.lastPartial.length !== 0) {
      return unusedOptions.filter(({ name }) => name.startsWith(env.lastPartial))
    }

    // suggest options that are not used
    return unusedOptions
  }
}

if (require.main === module) {
  const env = parseEnv(process.env)

  if (existsSync(AUTOCOMPLETION_FILE)) {
    const program = JSON.parse(readFileSync(AUTOCOMPLETION_FILE, 'utf-8'))
    const autocomplete = getAutocompletion(env, program)

    if (autocomplete && autocomplete.length !== 0) {
      log(autocomplete)
    }
  }
}

module.exports = { getAutocompletion }
