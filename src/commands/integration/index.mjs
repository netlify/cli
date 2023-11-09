import { createDeployCommand } from './deploy.mjs';
/**
 * The int command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const integrations = (options, command) => {
    command.help();
};
/**
 * Creates the `netlify integration` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createIntegrationCommand = (program) => {
    createDeployCommand(program);
    return program
        .command('integration')
        .alias('int')
        .description('Manage Netlify Integrations built with the Netlify SDK')
        .action(integrations);
};
