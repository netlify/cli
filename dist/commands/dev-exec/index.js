import { normalizeContext } from '../../utils/env/index.js';
export const createDevExecCommand = (program) => program
    .command('dev:exec')
    .argument('<...cmd>', `the command that should be executed`)
    .option('--context <context>', 'Specify a deploy context for environment variables (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: dev)', normalizeContext, 'dev')
    .description('Runs a command within the netlify dev environment. For example, with environment variables from any installed add-ons')
    .allowExcessArguments(true)
    .addExamples([
    'netlify dev:exec npm run bootstrap',
    'netlify dev:exec --context deploy-preview npm run bootstrap # Run with env var values from deploy-preview context',
    'netlify dev:exec --context branch:feat/make-it-pop npm run bootstrap # Run with env var values from the feat/make-it-pop branch context or branch-deploy context',
])
    .action(async (cmd, options, command) => {
    const { devExec } = await import('./dev-exec.js');
    await devExec(cmd, options, command);
});
//# sourceMappingURL=index.js.map