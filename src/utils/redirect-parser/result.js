class Result {
  constructor() {
    this.success = []
    this.errors = []
  }

  addSuccess(redirect) {
    this.success.push(redirect)
  }

  addError(idx, line, options) {
    const reason = options && options.reason
    this.errors.push({
      lineNum: idx + 1,
      line,
      reason,
    })
  }
}

module.exports = Result
