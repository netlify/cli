const addons = (options, command) => {
    command.help();
};
export const createAddonsCommand = (program) => {
    program
        .command('addons:auth', { hidden: true })
        .alias('addon:auth')
        .argument('<name>', 'Add-on slug')
        .description('Login to add-on provider')
        .action(async (addonName, options, command) => {
        const { addonsAuth } = await import('./addons-auth.js');
        await addonsAuth(addonName, options, command);
    });
    program
        .command('addons:config', { hidden: true })
        .alias('addon:config')
        .argument('<name>', 'Add-on namespace')
        .description('Configure add-on settings')
        // allow for any flags. Handy for variadic configuration options
        .allowUnknownOption(true)
        .action(async (addonName, options, command) => {
        const { addonsConfig } = await import('./addons-config.js');
        await addonsConfig(addonName, options, command);
    });
    program
        .command('addons:create', { hidden: true })
        .alias('addon:create')
        .argument('<name>', 'Add-on namespace')
        .description(`Add an add-on extension to your site
Add-ons are a way to extend the functionality of your Netlify site`)
        // allow for any flags. Handy for variadic configuration options
        .allowUnknownOption(true)
        .action(async (addonName, options, command) => {
        const { addonsCreate } = await import('./addons-create.js');
        await addonsCreate(addonName, options, command);
    });
    program
        .command('addons:delete', { hidden: true })
        .alias('addon:delete')
        .argument('<name>', 'Add-on namespace')
        .description(`Remove an add-on extension to your site\nAdd-ons are a way to extend the functionality of your Netlify site`)
        .option('-f, --force', 'delete without prompting (useful for CI)')
        .action(async (addonName, options, command) => {
        const { addonsDelete } = await import('./addons-delete.js');
        await addonsDelete(addonName, options, command);
    });
    program
        .command('addons:list', { hidden: true })
        .alias('addon:list')
        .description(`List currently installed add-ons for site`)
        .option('--json', 'Output add-on data as JSON')
        .action(async (options, command) => {
        const { addonsList } = await import('./addons-list.js');
        await addonsList(options, command);
    });
    return program
        .command('addons', { hidden: true })
        .alias('addon')
        .description('[Deprecated and will be removed from future versions] Manage Netlify Add-ons')
        .addExamples([
        'netlify addons:create addon-xyz',
        'netlify addons:list',
        'netlify addons:config addon-xyz',
        'netlify addons:delete addon-xyz',
        'netlify addons:auth addon-xyz',
    ])
        .action(addons);
};
