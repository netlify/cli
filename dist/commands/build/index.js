import process from 'process';
import terminalLink from 'terminal-link';
import { normalizeContext } from '../../utils/env/index.js';
export const createBuildCommand = (program) => program
    .command('build')
    .description('Build on your local machine')
    .option('--context <context>', 'Specify a deploy context for environment variables read during the build (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: value of CONTEXT or ”production”)', normalizeContext, process.env.CONTEXT || 'production')
    .option('--dry', 'Dry run: show instructions without running them', false)
    .option('-o, --offline', 'Disables any features that require network access')
    .addExamples([
    'netlify build',
    'netlify build --context deploy-preview # Build with env var values from deploy-preview context',
    'netlify build --context branch:feat/make-it-pop # Build with env var values from the feat/make-it-pop branch context or branch-deploy context',
])
    .addHelpText('after', () => {
    const docsUrl = 'https://docs.netlify.com/configure-builds/overview/';
    return `
For more information about Netlify builds, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`;
})
    .action(async (options, command) => {
    const { build } = await import('./build.js');
    await build(options, command);
});
//# sourceMappingURL=index.js.map