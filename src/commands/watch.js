const Command = require('../utils/command')
const { CLIError } = require('@oclif/errors')
const cli = require('cli-ux').default
const prettyjson = require('prettyjson')
const chalk = require('chalk')

const { waitForBuildFinish } = require('../utils/logs')

class SitesWatchCommand extends Command {
  async run() {
    const { args } = this.parse(SitesWatchCommand)
    await this.authenticate()
    const client = this.netlify.api
    const siteId = this.netlify.site.id

    const [accessToken] = this.getConfigToken()

    // wait for 1 sec for everything to kickoff
    console.time('Deploy time')
    await cli.wait(1000)

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'watch'
      }
    })

    // Get latest commit and look for that
    // git rev-parse HEAD

    // if no sha, its a manual "triggered deploy"
    /*
    {
        "id": "5b4e23db82d3f1780abd74f3",
        "deploy_id": "5b4e23db82d3f1780abd74f2",
        "sha": "pull/1/head",
        "log": [],
        "done": false,
        "error": null,
        "created_at": "2018-07-17T17:14:03.423Z"
    }
    */
    cli.action.start('Waiting for active site deploys to complete')
    try {
      // Fetch all builds!
      // const builds = await client.listSiteBuilds({siteId})
      //
      // // Filter down to any that are not done
      // const buildsToWatch = builds.filter((build) => {
      //   return !build.done
      // })

      const noActiveBuilds = await waitForBuildFinish(client, siteId, args.deployId, accessToken)

      const siteData = await client.getSite({ siteId })

      const message = chalk.cyanBright.bold.underline(noActiveBuilds ? 'Last build' : 'Deploy complete')
      this.log()
      this.log(message)
      this.log(
        prettyjson.render({
          URL: siteData.ssl_url || siteData.url,
          Admin: siteData.admin_url
        })
      )
      console.timeEnd('Deploy time')
    } catch (err) {
      throw new CLIError(err)
    }

    this.exit()
  }
}

SitesWatchCommand.description = `Watch for site deploy to finish`

SitesWatchCommand.examples = [`netlify watch`, `git push && netlify watch`]

SitesWatchCommand.args = [
  { name: 'deployId' },
]

module.exports = SitesWatchCommand
