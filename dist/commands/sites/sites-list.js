import { listSites } from '../../lib/api.js';
import { startSpinner } from '../../lib/spinner.js';
import { chalk, log, logJson } from '../../utils/command-helpers.js';
export const sitesList = async (options, command) => {
    const { api } = command.netlify;
    let spinner;
    if (!options.json) {
        spinner = startSpinner({ text: 'Loading your projects' });
    }
    await command.authenticate();
    const sites = await listSites({ api, options: { filter: 'all' } });
    if (spinner) {
        spinner.success();
    }
    if (sites && sites.length !== 0) {
        const logSites = sites.map((site) => {
            const siteInfo = {
                id: site.id,
                name: site.name,
                ssl_url: site.ssl_url,
                account_name: site.account_name,
            };
            if (site.build_settings && site.build_settings.repo_url) {
                siteInfo.repo_url = site.build_settings.repo_url;
            }
            return siteInfo;
        });
        // Json response for piping commands
        if (options.json) {
            const redactedSites = sites.map((site) => {
                if (site?.build_settings?.env) {
                    delete site.build_settings.env;
                }
                return site;
            });
            logJson(redactedSites);
            return false;
        }
        log(`
────────────────────────────┐
 Current Netlify Projects │
────────────────────────────┘

Count: ${logSites.length}
`);
        logSites.forEach((logSite) => {
            log(`${chalk.greenBright(logSite.name)} - ${logSite.id}`);
            log(`  ${chalk.whiteBright.bold('url:')}  ${chalk.yellowBright(logSite.ssl_url)}`);
            if (logSite.repo_url) {
                log(`  ${chalk.whiteBright.bold('repo:')} ${chalk.white(logSite.repo_url)}`);
            }
            if (logSite.account_name) {
                log(`  ${chalk.whiteBright.bold('account:')} ${chalk.white(logSite.account_name)}`);
            }
            log(`─────────────────────────────────────────────────`);
        });
    }
};
//# sourceMappingURL=sites-list.js.map