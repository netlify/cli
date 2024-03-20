export const createUnlinkCommand = (program) => program
    .command('unlink')
    .description('Unlink a local folder from a Netlify site')
    .action(async (options, command) => {
    const { unlink } = await import('./unlink.js');
    await unlink(options, command);
});
