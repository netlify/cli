const { hrtime } = require('process')

const { Command } = require('@oclif/command')
const { ExitError } = require('@oclif/errors')

const { track } = require('.')

const NANO_SECS_TO_MSECS = 1e6

const getDuration = function (startTime) {
  const durationNs = hrtime.bigint() - startTime
  return Math.round(Number(durationNs / BigInt(NANO_SECS_TO_MSECS)))
}

const isSafeError = function (error) {
  // The `exit` oclif utility returns an ExitError even when the exit code is 0
  return error instanceof ExitError && error.oclif && error.oclif.exit === 0
}

const getStatus = function (error) {
  if (error === undefined || isSafeError(error)) {
    return 'success'
  }

  return 'error'
}

class TrackedCommand extends Command {
  async init() {
    this.analytics = { startTime: hrtime.bigint() }
    await super.init()
  }

  setAnalyticsPayload(payload) {
    this.analytics = { ...this.analytics, payload }
  }

  async finally(error) {
    const { startTime, payload } = this.analytics
    const duration = getDuration(startTime)
    const status = getStatus(error)
    await track('command', {
      ...payload,
      command: this.id,
      duration,
      status,
    })
  }
}

module.exports = { TrackedCommand }
