const pWaitFor = require('p-wait-for')
const cli = require('cli-ux').default

const getLogStreamer = require('./log_streamers')

async function waitForBuildFinish(api, siteId, deployId, accessToken) {
    let firstPass = true
    let p = new Promise(() => {})

    if (deployId) {
        p = new Promise(async (_, reject) => {
            const deployment = await api.getDeploy({ deploy_id: deployId })
            const streamer = getLogStreamer(
                {
                    ...deployment.log_access_attributes,
                    deployId: deployment.id,
                    buildId: deployment.build_id,
                    date: deployment.created_at,
                    resource: 'build',
                    accessToken: accessToken,
                },
                () => deployment.log_access_attributes,
            )
            streamer.listen(bit => console.log(bit && `${new Date(bit.ts || bit.time).toLocaleTimeString()}: ${bit.log}`), reject)
        })
    }

    await Promise.race([p, pWaitFor(waitForBuildToFinish, {
        interval: 1000,
        timeout: 1.2e6, // 20 mins,
        message: 'Timeout while waiting for deploy to finish'
    })])

    // return only when build done or timeout happens
    return firstPass

    async function waitForBuildToFinish() {
        const builds = await api.listSiteBuilds({ siteId })
        const currentBuilds = builds.filter(build => {
            // build.error
            return !build.done && (deployId ? build.deploy_id === deployId : true)
        })

        // if build.error
        // @TODO implement build error messages into this

        if (!currentBuilds || !currentBuilds.length) {
            cli.action.stop()
            return true
        }
        firstPass = false
        return false
    }
}

module.exports = {
    waitForBuildFinish,
}
