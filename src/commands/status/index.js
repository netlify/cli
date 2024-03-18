import requiresSiteInfo from '../../utils/hooks/requires-site-info.js';
export const createStatusCommand = (program) => {
    program
        .command('status:hooks')
        .description('Print hook information of the linked site')
        .hook('preAction', requiresSiteInfo)
        .action(async (_, command) => {
        const { statusHooks } = await import('./status-hooks.js');
        await statusHooks(command);
    });
    return program
        .command('status')
        .description('Print status information')
        .option('--verbose', 'Output system info')
        .action(async (options, command) => {
        const { status } = await import('./status.js');
        await status(options, command);
    });
};
