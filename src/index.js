const updateNotifier = require('update-notifier')
const pkg = require('../package.json')

try {
  updateNotifier({ pkg }).notify()
} catch (e) {
  console.log('Error checking for updates:')
  console.log(e)
}

module.exports = require('@oclif/command')
