import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'tabt... Remove this comment to see the full error message
import { install, uninstall } from 'tabtab';
import { generateAutocompletion } from '../../lib/completion/index.mjs';
const completer = join(dirname(fileURLToPath(import.meta.url)), '../../lib/completion/script.mjs');
/**
 * The completion:generate command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const completionGenerate = async (options, command) => {
    const { parent } = command;
    generateAutocompletion(parent);
    await install({
        name: parent.name(),
        completer,
    });
    console.log(`Completion for ${parent.name()} successful installed!`);
};
/**
 * Creates the `netlify completion` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createCompletionCommand = (program) => {
    program
        .command('completion:install')
        .alias('completion:generate')
        .description('Generates completion script for your preferred shell')
        .action(completionGenerate);
    program
        .command('completion:uninstall', { hidden: true })
        .alias('completion:remove')
        .description('Uninstalls the installed completions')
        .addExamples(['netlify completion:uninstall'])
        // @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
        .action(async (options, command) => {
        await uninstall({
            name: command.parent.name(),
        });
    });
    return program
        .command('completion')
        .description('Generate shell completion script\nRun this command to see instructions for your shell.')
        .addExamples(['netlify completion:install'])
        // @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
        .action((options, command) => {
        command.help();
    });
};
