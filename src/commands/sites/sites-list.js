import prettyjson from 'prettyjson';
import { listSites } from '../../lib/api.js';
import { chalk } from '../../utils/command-helpers.js';
import { NetlifyLog, intro, outro, spinner } from '../../utils/styles/index.js';
export const sitesList = async (options, command) => {
    !options.isChildCommand && intro('sites:list');
    const { api } = command.netlify;
    const loading = spinner();
    if (!options.json) {
        loading.start('Loading your sites');
    }
    await command.authenticate();
    const sites = await listSites({ api, options: { filter: 'all' } });
    if (!options.json) {
        loading.stop();
    }
    if (sites && sites.length !== 0) {
        // @ts-expect-error TS(7006) FIXME: Parameter 'site' implicitly has an 'any' type.
        const logSites = sites.map((site) => {
            const siteInfo = {
                id: site.id,
                name: site.name,
                ssl_url: site.ssl_url,
                account_name: site.account_name,
            };
            if (site.build_settings && site.build_settings.repo_url) {
                // @ts-expect-error TS(2339) FIXME: Property 'repo_url' does not exist on type '{ id: ... Remove this comment to see the full error message
                siteInfo.repo_url = site.build_settings.repo_url;
            }
            return siteInfo;
        });
        // Json response for piping commands
        if (options.json) {
            // @ts-expect-error TS(7006) FIXME: Parameter 'site' implicitly has an 'any' type.
            const redactedSites = sites.map((site) => {
                if (site && site.build_settings) {
                    delete site.build_settings.env;
                }
                return site;
            });
            NetlifyLog.info(prettyjson.render(redactedSites));
            return false;
        }
        // @ts-expect-error TS(7006) FIXME: Parameter 'logSite' implicitly has an 'any' type.
        logSites.forEach((logSite) => {
            NetlifyLog.info(`${chalk.greenBright(logSite.name)} - ${logSite.id}`);
            NetlifyLog.info(`  ${chalk.whiteBright.bold('url:')}  ${chalk.yellowBright(logSite.ssl_url)}`);
            if (logSite.repo_url) {
                NetlifyLog.info(`  ${chalk.whiteBright.bold('repo:')} ${chalk.white(logSite.repo_url)}`);
            }
            if (logSite.account_name) {
                NetlifyLog.info(`  ${chalk.whiteBright.bold('account:')} ${chalk.white(logSite.account_name)}`);
            }
        });
    }
    !options.isChildCommand && outro({ exit: true, message: `Site count: ${sites.length}` });
};
