import execa from 'execa'

import { cliPath } from './cli-path.js'

const CLI_TIMEOUT = 3e5

/**
 * Calls the Cli with a max timeout.
 * If the `parseJson` argument is specified then the result will be converted into an object.
 * @param {readonly string[]} args
 * @param {execa.Options<string>} execOptions
 * @param {boolean} parseJson
 * @returns {Promise<string|object>}
 */
export const callCli = async function (args, execOptions = {}, parseJson = false) {
  console.log('Running', { cliPath, args })
  const childProcess = execa(cliPath, args, {
    timeout: CLI_TIMEOUT,
    nodeOptions: [],
    stdio: 'pipe',
    ...execOptions,
  })

  let stdout = ''
  childProcess.stdout.on('data', (data) => {
    console.log(data.toString())
    stdout += data.toString()
  })

  childProcess.stderr.on('data', (data) => {
    console.error(data.toString())
  })

  await new Promise((resolve) => {
    childProcess.on('exit', resolve)
  })

  if (parseJson) {
    return JSON.parse(stdout)
  }
  return stdout
}
