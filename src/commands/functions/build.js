const fs = require('fs')
const process = require('process')

const { zipFunctions } = require('@netlify/zip-it-and-ship-it')
const { flags: flagsLib } = require('@oclif/command')

const Command = require('../../utils/command')
const {
  // NETLIFYDEV,
  NETLIFYDEVLOG,
  // NETLIFYDEVWARN,
  NETLIFYDEVERR,
} = require('../../utils/logo')

class FunctionsBuildCommand extends Command {
  async run() {
    const { flags } = this.parse(FunctionsBuildCommand)
    const { config } = this.netlify

    const src = flags.src || config.build.functionsSource
    const dst =
      flags.functions ||
      (config.dev && config.dev.functions) ||
      (config.build && config.build.functions) ||
      flags.Functions ||
      (config.dev && config.dev.Functions) ||
      (config.build && config.build.Functions)

    if (src === dst) {
      this.log(`${NETLIFYDEVERR} Source and destination for function build can't be the same`)
      process.exit(1)
    }

    if (!src || !dst) {
      if (!src)
        this.log(
          `${NETLIFYDEVERR} Error: You must specify a source folder with a --src flag or a functionsSource field in your config`,
        )
      if (!dst)
        this.log(
          `${NETLIFYDEVERR} Error: You must specify a destination functions folder with a --functions flag or a functions field in your config`,
        )
      process.exit(1)
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'functions:build',
      },
    })

    fs.mkdirSync(dst, { recursive: true })

    this.log(`${NETLIFYDEVLOG} Building functions`)
    zipFunctions(src, dst, { skipGo: true })
    this.log(`${NETLIFYDEVLOG} Functions built to `, dst)
  }
}

FunctionsBuildCommand.description = `Build functions locally
`
FunctionsBuildCommand.aliases = ['function:build']
FunctionsBuildCommand.flags = {
  functions: flagsLib.string({
    char: 'f',
    description: 'Specify a functions folder to build to',
  }),
  src: flagsLib.string({
    char: 's',
    description: 'Specify the source folder for the functions',
  }),
  ...FunctionsBuildCommand.flags,
}

module.exports = FunctionsBuildCommand
