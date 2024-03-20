import { Option, Argument } from 'commander';
import { CLI_LOG_LEVEL_CHOICES_STRING } from './log-levels.js';
export const createLogsBuildCommand = (program) => {
    program
        .command('logs:deploy')
        .alias('logs:build')
        .description('(Beta) Stream the logs of deploys currently being built to the console')
        .action(async (options, command) => {
        const { logsBuild } = await import('./build.js');
        await logsBuild(options, command);
    });
};
export const createLogsFunctionCommand = (program) => {
    program
        .command('logs:function')
        .alias('logs:functions')
        .addOption(new Option('-l, --level <levels...>', `Log levels to stream. Choices are:${CLI_LOG_LEVEL_CHOICES_STRING}`))
        .addArgument(new Argument('[functionName]', 'Name of the function to stream logs for'))
        .addExamples([
        'netlify logs:function',
        'netlify logs:function my-function',
        'netlify logs:function my-function -l info warn',
    ])
        .description('(Beta) Stream netlify function logs to the console')
        .action(async (functionName, options, command) => {
        const { logsFunction } = await import('./functions.js');
        await logsFunction(functionName, options, command);
    });
};
export const createLogsCommand = (program) => {
    createLogsBuildCommand(program);
    createLogsFunctionCommand(program);
    return program
        .command('logs')
        .alias('log')
        .description('Stream logs from your site')
        .addExamples(['netlify logs:deploy', 'netlify logs:function', 'netlify logs:function my-function'])
        .action((_, command) => command.help());
};
