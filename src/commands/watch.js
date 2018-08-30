const Command = require('../base')
const { CLIError } = require('@oclif/errors')
const pWaitFor = require('p-wait-for')
const cli = require('cli-ux').default
const prettyjson = require('prettyjson')
const chalk = require('chalk')
const renderShortDesc = require('../utils/renderShortDescription')

class SitesWatchCommand extends Command {
  async run() {
    // const { flags } = this.parse(SitesWatchCommand)
    await this.authenticate()
    const client = this.netlify
    const siteId = this.site.get('siteId')

    // wait for 1 sec for everything to kickoff
    console.time('Deploy time')
    await cli.wait(1000)

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
    cli.action.start('Watching for site to finish deploy')
    try {
      // Fetch all builds!
      // const builds = await client.listSiteBuilds({siteId})
      //
      // // Filter down to any that are not done
      // const buildsToWatch = builds.filter((build) => {
      //   return !build.done
      // })

      await waitForBuildFinish(client, siteId)

      const siteData = await client.getSite({ siteId })

      const message = chalk.cyanBright.bold.underline('Deploy complete')
      console.log()
      console.log(message)
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

SitesWatchCommand.description = `${renderShortDesc('Watch for site deploy to finish')}`
SitesWatchCommand.examples = [`$ netlify watch`, `$ git push && netlify watch`]

async function waitForBuildFinish(api, siteId) {
  let buildDone = false

  await pWaitFor(waitForBuildToFinish, {
    interval: 5000,
    timeout: 1.2e6, // 20 mins,
    message: 'Timeout while waiting for deploy to finish'
  })

  // return only when build done or timeout happens
  return buildDone

  async function waitForBuildToFinish() {
    const builds = await api.listSiteBuilds({ siteId })
    const currentBuilds = builds.filter(build => {
      return !build.done
    })
    if (!currentBuilds || !currentBuilds.length) {
      cli.action.stop()
      buildDone = true
      return true
    }
    return false
  }
}

module.exports = SitesWatchCommand
