const updateNotifier = require('update-notifier')
const pkg = require('../package.json')

try {
  updateNotifier({ pkg }).notify()
} catch (_) {
  // noop
}

module.exports = require('@oclif/command')
