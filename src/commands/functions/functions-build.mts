// @ts-check

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'mkdir'.
const { mkdir } = require('fs/promises')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const { NETLIFYDEVERR, NETLIFYDEVLOG, exit, getFunctionsDir, log } = require('../../utils/index.mjs')

/**
 * The functions:build command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const functionsBuild = async (options: $TSFixMe, command: $TSFixMe) => {
  const { config } = command.netlify

  const src = options.src || config.build.functionsSource
  const dst = getFunctionsDir({ options, config })

  if (src === dst) {
    log(`${NETLIFYDEVERR} Source and destination for function build can't be the same`)
    exit(1)
  }

  if (!src || !dst) {
    if (!src)
      log(
        `${NETLIFYDEVERR} Error: You must specify a source folder with a --src flag or a functionsSource field in your config`,
      )
    if (!dst)
      log(
        `${NETLIFYDEVERR} Error: You must specify a destination functions folder with a --functions flag or a functions field in your config`,
      )
    exit(1)
  }

  await mkdir(dst, { recursive: true })

  log(`${NETLIFYDEVLOG} Building functions`)

  const { zipFunctions } = await import('@netlify/zip-it-and-ship-it')

  // @ts-expect-error TS(2345): Argument of type '{ skipGo: boolean; }' is not ass... Remove this comment to see the full error message
  zipFunctions(src, dst, { skipGo: true })
  log(`${NETLIFYDEVLOG} Functions built to `, dst)
}

/**
 * Creates the `netlify functions:build` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createFunc... Remove this comment to see the full error message
const createFunctionsBuildCommand = (program: $TSFixMe) => program
  .command('functions:build')
  .alias('function:build')
  .description('Build functions locally')
  .option('-f, --functions <directory>', 'Specify a functions directory to build to')
  .option('-s, --src <directory>', 'Specify the source directory for the functions')
  .action(functionsBuild)

module.exports = { createFunctionsBuildCommand }
