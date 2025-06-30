export const createSwitchCommand = (program) => program
    .command('switch')
    .description('Switch your active Netlify account')
    .action(async (options, command) => {
    const { switchCommand } = await import('./switch.js');
    await switchCommand(options, command);
});
//# sourceMappingURL=index.js.map