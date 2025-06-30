import terminalLink from 'terminal-link';
export const createUnlinkCommand = (program) => program
    .command('unlink')
    .description('Unlink a local folder from a Netlify project')
    .addHelpText('after', () => {
    const docsUrl = 'https://docs.netlify.com/cli/get-started/#link-and-unlink-sites';
    return `
For more information about linking projects, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`;
})
    .action(async (options, command) => {
    const { unlink } = await import('./unlink.js');
    await unlink(options, command);
});
//# sourceMappingURL=index.js.map