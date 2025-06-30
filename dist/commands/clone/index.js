import terminalLink from 'terminal-link';
export const createCloneCommand = (program) => program
    .command('clone')
    .description(`Clone a remote repository and link it to an existing project on Netlify
Use this command when the existing Netlify project is already configured to deploy from the existing repo.

If you specify a target directory, the repo will be cloned into that directory. By default, a directory will be created with the name of the repo.

To specify a project, use --id or --name. By default, the Netlify project to link will be automatically detected if exactly one project found is found with a matching git URL. If we cannot find such a project, you will be interactively prompted to select one.`)
    .argument('<repo>', 'URL of the repository to clone or Github `owner/repo` (required)')
    .argument('[targetDir]', 'directory in which to clone the repository - will be created if it does not exist')
    .option('--id <id>', 'ID of existing Netlify project to link to')
    .option('--name <name>', 'Name of existing Netlify project to link to')
    .addExamples([
    'netlify clone vibecoder/next-unicorn',
    'netlify clone https://github.com/vibecoder/next-unicorn.git',
    'netlify clone git@github.com:vibecoder/next-unicorn.git',
    'netlify clone vibecoder/next-unicorn ./next-unicorn-shh-secret',
    'netlify clone --id 123-123-123-123 vibecoder/next-unicorn',
    'netlify clone --name my-project-name vibecoder/next-unicorn',
])
    .addHelpText('after', () => {
    const docsUrl = 'https://docs.netlify.com/cli/get-started/#link-and-unlink-sites';
    return `For more information about linking projects, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}\n`;
})
    .action(async (repo, targetDir, options, command) => {
    const { clone } = await import('./clone.js');
    await clone(options, command, { repo, targetDir });
});
//# sourceMappingURL=index.js.map