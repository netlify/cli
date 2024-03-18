import { Option } from 'commander';
export const createLinkCommand = (program) => program
    .command('link')
    .description('Link a local repo or project folder to an existing site on Netlify')
    .option('--id <id>', 'ID of site to link to')
    .option('--name <name>', 'Name of site to link to')
    .addOption(new Option('--gitRemoteName <name>', 'Old, prefer --git-remote-name. Name of Git remote to use. e.g. "origin"').hideHelp(true))
    .option('--git-remote-name <name>', 'Name of Git remote to use. e.g. "origin"')
    .addExamples(['netlify link', 'netlify link --id 123-123-123-123', 'netlify link --name my-site-name'])
    .action(async (options, command) => {
    const { link } = await import('./link.js');
    await link(options, command);
});
