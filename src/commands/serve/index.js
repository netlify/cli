const { Command, flags } = require('@oclif/command')
const AsciiTable = require('ascii-table')
const { execSync, spawn } = require('child_process')
const chalk = require('chalk')
const http = require('http')
const httpProxy = require('http-proxy')
const renderShortDesc = require('../../utils/renderShortDescription')
const { serverSettings } = require('../../utils/detect-server')


class ServeCommand extends Command {
  async run() {
    const { flags, args } = this.parse(ServeCommand)
    const settings = serverSettings()

    const ps = spawn(settings.cmd, settings.args, {env: settings.env})

    ps.stdout.on('data', (data) => {
      console.log(`${data}`.replace(settings.urlRegexp, `$1$2${settings.port}$3`));
    });

    ps.stderr.on('data', (data) => {
      console.error(`${data}`);
    });

    ps.on('close', (code) => {
      process.exit(code)
    });

    console.log('process running: ', ps.pid);
    const proxy = httpProxy.createProxyServer({})

    const server = http.createServer(function(req, res) {
      proxy.web(req, res, { target: `http://localhost:${settings.proxyPort}` })
    })

    server.listen(settings.port)
  }
}

ServeCommand.description = `${renderShortDesc('Handle site operations')}
The serve command will run a local dev server with Netlify's proxy and redirect rules
`

ServeCommand.examples = [
  '$ netlify serve -c "yarn start"',
  '$ netlify serve -c hugo',
]

ServeCommand.strict = false

ServeCommand.flags = {
  cmd: flags.string({char: 'c', description: 'command to run'}),
}

module.exports = ServeCommand
