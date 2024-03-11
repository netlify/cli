import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'tabt... Remove this comment to see the full error message
import { install, uninstall } from 'tabtab';
import { generateAutocompletion } from '../../lib/completion/index.js';
import { error } from '../../utils/command-helpers.js';
const completer = join(dirname(fileURLToPath(import.meta.url)), '../../lib/completion/script.js');
export const completionGenerate = async (options, command) => {
    const { parent } = command;
    if (!parent) {
        error(`There has been an error generating the completion script.`);
        return;
    }
    generateAutocompletion(parent);
    await install({
        name: parent.name(),
        completer,
    });
    console.log(`Completion for ${parent.name()} successful installed!`);
};
export const completionUninstall = async (options, command) => {
    if (!command.parent) {
        error(`There has been an error deleting the completion script.`);
        return;
    }
    await uninstall({
        name: command.parent.name(),
    });
};
