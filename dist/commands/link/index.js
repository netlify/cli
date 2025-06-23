import terminalLink from 'terminal-link';
export const createLinkCommand = (program) => program
    .command('link')
    .description('Link a local repo or project folder to an existing project on Netlify')
    .option('--id <id>', 'ID of project to link to')
    .option('--name <name>', 'Name of project to link to')
    .option('--git-remote-name <name>', 'Name of Git remote to use. e.g. "origin"')
    .option('--git-remote-url <name>', 'URL of the repository (or Github `owner/repo`) to link to')
    .addExamples([
    'netlify link',
    'netlify link --id 123-123-123-123',
    'netlify link --name my-project-name',
    'netlify link --git-remote-url https://github.com/vibecoder/my-unicorn.git',
])
    .addHelpText('after', () => {
    const docsUrl = 'https://docs.netlify.com/cli/get-started/#link-and-unlink-sites';
    return `
For more information about linking projects, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`;
})
    .action(async (options, command) => {
    const { link } = await import('./link.js');
    await link(options, command);
});
//# sourceMappingURL=index.js.map