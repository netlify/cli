import { chalk, log } from '../command-helpers.js';
import { configGithub } from './config-github.js';
import configManual from './config-manual.js';
const logSuccess = ({ provider }) => {
    log();
    log(chalk.greenBright.bold.underline(`Success! Netlify CI/CD Configured!`));
    log();
    log(`This project is now configured to automatically deploy from ${provider} branches & pull requests`);
    log();
    log(`Next steps:

  ${chalk.cyanBright.bold('git push')}       Push to your git repository to trigger new project builds
  ${chalk.cyanBright.bold('netlify open')}   Open the Netlify admin URL of your project
  `);
};
export const configureRepo = async ({ command, manual, repoData, siteId, }) => {
    if (manual) {
        await configManual({ command, siteId, repoData });
    }
    else if (repoData.provider === 'github') {
        await configGithub({ command, siteId, repoName: repoData.name ?? '', repoOwner: repoData.owner ?? '' });
    }
    else {
        log(`No configurator found for the provided git remote. Configuring manually...`);
        await configManual({ command, siteId, repoData });
    }
    logSuccess(repoData);
};
//# sourceMappingURL=config.js.map