import pWaitFor from 'p-wait-for';
import prettyjson from 'prettyjson';
import { startSpinner, stopSpinner } from '../../lib/spinner.js';
import { chalk, logAndThrowError, log } from '../../utils/command-helpers.js';
import { init } from '../init/init.js';
// 1 second
const INIT_WAIT = 1e3;
// 1 second
const BUILD_FINISH_INTERVAL = 1e3;
// 20 minutes
const BUILD_FINISH_TIMEOUT = 12e5;
const waitForBuildFinish = async function (api, siteId, spinner) {
    let firstPass = true;
    const waitForBuildToFinish = async function () {
        const builds = await api.listSiteBuilds({ siteId });
        // build.error
        const currentBuilds = builds.filter((build) => !build.done);
        // if build.error
        // @TODO implement build error messages into this
        if (!currentBuilds || currentBuilds.length === 0) {
            stopSpinner({ spinner });
            return true;
        }
        firstPass = false;
        return false;
    };
    await pWaitFor(waitForBuildToFinish, {
        interval: BUILD_FINISH_INTERVAL,
        timeout: {
            milliseconds: BUILD_FINISH_TIMEOUT,
            message: 'Timeout while waiting for deploy to finish',
        },
    });
    // return only when build done or timeout happens
    return firstPass;
};
export const watch = async (_options, command) => {
    await command.authenticate();
    const client = command.netlify.api;
    let siteId = command.netlify.site.id;
    if (!siteId) {
        // TODO: build init command
        const siteData = await init({}, command);
        siteId = siteData.id;
    }
    // wait for 1 sec for everything to kickoff
    console.time('Deploy time');
    await new Promise((resolve) => {
        setTimeout(() => {
            resolve(undefined);
        }, INIT_WAIT);
    });
    // Get latest commit and look for that
    // git rev-parse HEAD
    // if no sha, its a manual "triggered deploy"
    //
    // {
    //     "id": "5b4e23db82d3f1780abd74f3",
    //     "deploy_id": "5b4e23db82d3f1780abd74f2",
    //     "sha": "pull/1/head",
    //     "log": [],
    //     "done": false,
    //     "error": null,
    //     "created_at": "2018-07-17T17:14:03.423Z"
    // }
    //
    const spinner = startSpinner({ text: 'Waiting for active project deploys to complete' });
    try {
        // Fetch all builds!
        // const builds = await client.listSiteBuilds({siteId})
        //
        // // Filter down to any that are not done
        // const buildsToWatch = builds.filter((build) => {
        //   return !build.done
        // })
        const noActiveBuilds = await waitForBuildFinish(client, siteId, spinner);
        const siteData = await client.getSite({ siteId });
        const message = chalk.cyanBright.bold.underline(noActiveBuilds ? 'Last build' : 'Deploy complete');
        log();
        log(message);
        log(prettyjson.render({
            URL: siteData.ssl_url || siteData.url,
            Admin: siteData.admin_url,
        }));
        console.timeEnd('Deploy time');
    }
    catch (error_) {
        return logAndThrowError(error_);
    }
};
//# sourceMappingURL=watch.js.map