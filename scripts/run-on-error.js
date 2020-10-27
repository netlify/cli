#!/usr/bin/env node
const process = require('process')

const execa = require('execa')

const [, , npmScript, npmScriptOnError] = process.argv

// Run a npm script. If that script fails, another npm script is run.
// We use this for example with ESLint and Prettier to be able to fail if
// anything should be autofixed, while still autofixing it. Those tools do not
// provide good CLI flags for this.
const runOnError = async function () {
  const { failed, exitCode = DEFAULT_ERROR_EXIT_CODE } = await runNpmScript(npmScript)
  if (!failed) {
    return
  }

  await runNpmScript(npmScriptOnError)
  process.exitCode = exitCode
}

const runNpmScript = function (npmScriptName) {
  return execa.command(`npm run ${npmScriptName}`, { stdio: 'inherit', reject: false })
}

const DEFAULT_ERROR_EXIT_CODE = 1

runOnError()
