const { existsSync, readFileSync } = require('fs')
const { read } = require('qqjs')

// Hardcoded for create react app right now, make this function look at cwd and find our from
// heuristics like package.json, hugo config file, etc, what settings to return
module.exports.serverSettings = () => {
  let package = null;
  if (existsSync('package.json')) {
    package = JSON.parse(readFileSync('package.json', {encoding: 'utf8'}))
  }

  const settings = {
    port: 8888,
    proxyPort: 3000,
    env: {...process.env, BROWSER: 'none', PORT: 3000},
    args: [],
    urlRegexp: new RegExp(`(http://)([^:]+:)${3000}(/)?`, 'g')
  }

  if (package) {
    if (existsSync('yarn.lock')) {
      settings.cmd = 'yarn'
    } else {
      settings.cmd = 'npm'
      settings.args.push('run')
    }

    if (package.scripts.start) {
      settings.args.push('start')
    } else if (package.scripts.serve) {
      settings.args.push('serve')
    } else if (package.scripts.run) {
      settings.args.push('run')
    } else {
      console.error('Couldn\'t determine the script to run. Use the -c flag.')
      process.exit(1)
    }
  }

  return settings;
}