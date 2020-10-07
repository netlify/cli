const Command = require('../../utils/command')
const { runProcess } = require('../../utils/traffic-mesh')

class TraceCommand extends Command {
  async run() {
    const args = ['trace'].concat(this.argv)
    const { subprocess } = await runProcess({ log: this.log, args })
    await subprocess

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'dev:trace',
      },
    })
  }
}

TraceCommand.description = `Trace command
Simulates Netlify's Edge routing logic to match specific requests. 
This command is designed to mimic cURL's command line, so the flags are more familiar.
`

TraceCommand.examples = [
  '$ netlify dev:trace http://localhost/routing-path',
  '$ netlify dev:trace -w dist-directory http://localhost/routing-path',
  '$ netlify dev:trace -X POST http://localhost/routing-path',
  '$ netlify dev:trace -H "Accept-Language es" http://localhost/routing-path',
  '$ netlify dev:trace --cookie nf_jwt=token http://localhost/routing-path',
]

TraceCommand.strict = false
TraceCommand.parse = false
TraceCommand.hidden = true

module.exports = TraceCommand
