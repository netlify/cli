import { env } from 'process';
const integrations = (options, command) => {
    command.help();
};
export const createIntegrationDeployCommand = (program) => {
    program
        .command('integration:deploy')
        .alias('int:deploy')
        .description('Register, build, and deploy a private integration on Netlify')
        .option('-p, --prod', 'Deploy to production', false)
        .option('-b, --build', 'Build the integration', false)
        .option('-a, --auth <token>', 'Netlify auth token to deploy with', env.NETLIFY_AUTH_TOKEN)
        .option('-s, --site <name-or-id>', 'A site name or ID to deploy to', env.NETLIFY_SITE_ID)
        .action(async (options, command) => {
        const { deploy } = await import('./deploy.js');
        await deploy(options, command);
    });
};
export const createIntegrationCommand = (program) => {
    createIntegrationDeployCommand(program);
    return program
        .command('integration')
        .alias('int')
        .description('Manage Netlify Integrations built with the Netlify SDK')
        .action(integrations);
};
