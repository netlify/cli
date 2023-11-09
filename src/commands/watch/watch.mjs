import pWaitFor from 'p-wait-for';
import prettyjson from 'prettyjson';
import { startSpinner, stopSpinner } from '../../lib/spinner.mjs';
import { chalk, error, log } from '../../utils/command-helpers.mjs';
import { init } from '../init/index.mjs';
// 1 second
const INIT_WAIT = 1e3;
// 1 second
const BUILD_FINISH_INTERVAL = 1e3;
// 20 minutes
const BUILD_FINISH_TIMEOUT = 12e5;
/**
 *
 * @param {import('netlify').NetlifyAPI} api
 * @param {string} siteId
 * @param {import('ora').Ora} spinner
 * @returns {Promise<boolean>}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'api' implicitly has an 'any' type.
const waitForBuildFinish = async function (api, siteId, spinner) {
    let firstPass = true;
    const waitForBuildToFinish = async function () {
        const builds = await api.listSiteBuilds({ siteId });
        // build.error
        // @ts-expect-error TS(7006) FIXME: Parameter 'build' implicitly has an 'any' type.
        const currentBuilds = builds.filter((build) => !build.done);
        // if build.error
        // @TODO implement build error messages into this
        if (!currentBuilds || currentBuilds.length === 0) {
            // @ts-expect-error TS(2345) FIXME: Argument of type '{ spinner: any; }' is not assign... Remove this comment to see the full error message
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
/**
 * The watch command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const watch = async (options, command) => {
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
        // @ts-expect-error TS(2794) FIXME: Expected 1 arguments, but got 0. Did you forget to... Remove this comment to see the full error message
        setTimeout(() => resolve(), INIT_WAIT);
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
    const spinner = startSpinner({ text: 'Waiting for active site deploys to complete' });
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
        // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
        error(error_);
    }
};
/**
 * Creates the `netlify watch` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createWatchCommand = (program) => program
    .command('watch')
    .description('Watch for site deploy to finish')
    .addExamples([`netlify watch`, `git push && netlify watch`])
    .action(watch);
