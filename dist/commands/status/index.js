import requiresSiteInfo from '../../utils/hooks/requires-site-info.js';
export const createStatusCommand = (program) => {
    program
        .command('status:hooks')
        .description('Print hook information of the linked project')
        .hook('preAction', requiresSiteInfo)
        .action(async (options, command) => {
        const { statusHooks } = await import('./status-hooks.js');
        await statusHooks(options, command);
    });
    program
        .command('status')
        .description('Print status information')
        .option('--verbose', 'Output system info')
        .option('--json', 'Output status information as JSON')
        .action(async (options, command) => {
        const { status } = await import('./status.js');
        await status(options, command);
    });
};
//# sourceMappingURL=index.js.map