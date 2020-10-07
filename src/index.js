const updateNotifier = require('update-notifier')
const pkg = require('../package.json')

try {
  updateNotifier({
    pkg,
    updateCheckInterval: 1000 * 60 * 60 * 12, // check every 1/2 day
  }).notify()
} catch (error) {
  console.log('Error checking for updates:')
  console.log(error)
}

module.exports = require('@oclif/command')
