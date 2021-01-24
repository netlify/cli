/**
 * An unrecoverable internal CLI error which should be reported.
 */
class InternalCliError extends Error {
  /**
   * Log a stack trace and the given context object for opening an issue, then
   * throw.
   *
   * @param {string!} message
   * @param {Object!} context
   */
  constructor(message, context) {
    super(message)
    this.name = 'InternalCliError'

    console.trace(
      `INTERNAL CLI ERROR. ${message}\n` +
        'Please open an issue at https://github.com/netlify/cli/issues/new ' +
        'and include the following information:' +
        `\n${JSON.stringify(context, null, 2)}\n`,
    )
  }
}

module.exports = {
  InternalCliError,
}
