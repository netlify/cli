const lm = (options, command) => {
    command.help();
};
export const createLmCommand = (program) => {
    program
        .command('lm:info', { hidden: true })
        .description('Show large media requirements information.')
        .action(async () => {
        const { lmInfo } = await import('./lm-info.js');
        await lmInfo();
    });
    program
        .command('lm:install', { hidden: true })
        .alias('lm:init')
        .description(`Configures your computer to use Netlify Large Media
It installs the required credentials helper for Git,
and configures your Git environment with the right credentials.`)
        .option('-f, --force', 'Force the credentials helper installation')
        .action(async (options) => {
        const { lmInstall } = await import('./lm-install.js');
        await lmInstall(options);
    });
    program
        .command('lm:setup', { hidden: true })
        .description('Configures your site to use Netlify Large Media')
        .option('-s, --skip-install', 'Skip the credentials helper installation check')
        .option('-f, --force-install', 'Force the credentials helper installation')
        .addHelpText('after', 'It runs the install command if you have not installed the dependencies yet.')
        .action(async (options, command) => {
        const { lmSetup } = await import('./lm-setup.js');
        await lmSetup(options, command);
    });
    program
        .command('lm:uninstall', { hidden: true })
        .alias('lm:remove')
        .description('Uninstalls Netlify git credentials helper and cleans up any related configuration changes made by the install command.')
        .action(async () => {
        const { lmUninstall } = await import('./lm-uninstall.js');
        await lmUninstall();
    });
    program
        .command('lm', { hidden: true })
        .description('[Deprecated and will be removed from future versions] Handle Netlify Large Media operations\nThe lm command will help you manage large media for a site')
        .addExamples(['netlify lm:info', 'netlify lm:install', 'netlify lm:setup'])
        .action(lm);
};
