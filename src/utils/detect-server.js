// Hardcoded for create react app right now, make this function look at cwd and find our from
// heuristics like package.json, hugo config file, etc, what settings to return
module.exports.serverSettings = () => {
  const port = 8888
  const proxyPort = 3000
  return {
    env: {...process.env, BROWSER: 'none', PORT: proxyPort},
    proxyPort: proxyPort,
    port: port,
    cmd: 'yarn',
    args: ['start'],
    urlRegexp: new RegExp(`(http://)([^:]+:)${proxyPort}(/)?`, 'g')
  }
}