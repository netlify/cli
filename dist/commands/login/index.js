import terminalLink from 'terminal-link';
export const createLoginCommand = (program) => program
    .command('login')
    .description(`Login to your Netlify account
Opens a web browser to acquire an OAuth token.`)
    .option('--new', 'Login to new Netlify account')
    .addHelpText('after', () => {
    const docsUrl = 'https://docs.netlify.com/cli/get-started/#authentication';
    return `
For more information about Netlify authentication, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`;
})
    .action(async (options, command) => {
    const { login } = await import('./login.js');
    await login(options, command);
});
//# sourceMappingURL=index.js.map