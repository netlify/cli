import fs from 'fs';
import { dirname } from 'path';
import { sortOptions, warn } from '../../utils/command-helpers.js';
import { AUTOCOMPLETION_FILE } from './constants.js';
/**
 * Create or updates the autocompletion information for the CLI
 * @param {import('../../commands/base-command.js').default} program
 * @returns {void}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
const generateAutocompletion = (program) => {
    try {
        const autocomplete = program.commands.reduce(
        // @ts-expect-error TS(7006) FIXME: Parameter 'prev' implicitly has an 'any' type.
        (prev, cmd) => ({
            ...prev,
            [cmd.name()]: {
                name: cmd.name(),
                description: cmd.description().split('\n')[0],
                options: cmd.options
                    // @ts-expect-error TS(7006) FIXME: Parameter 'option' implicitly has an 'any' type.
                    .filter((option) => !option.hidden)
                    .sort(sortOptions)
                    // @ts-expect-error TS(7006) FIXME: Parameter 'opt' implicitly has an 'any' type.
                    .map((opt) => ({ name: `--${opt.name()}`, description: opt.description })),
            },
        }), {});
        if (!fs.existsSync(dirname(AUTOCOMPLETION_FILE))) {
            fs.mkdirSync(dirname(AUTOCOMPLETION_FILE), { recursive: true });
        }
        fs.writeFileSync(AUTOCOMPLETION_FILE, JSON.stringify(autocomplete), 'utf-8');
    }
    catch (error_) {
        // Sometimes it can happen that the autocomplete generation in the postinstall script lacks permissions
        // to write files to the home directory of the user. Therefore just warn with the error and don't break install.
        if (error_ instanceof Error) {
            warn(`could not create autocompletion.\n${error_.message}`);
        }
    }
};
export default generateAutocompletion;
//# sourceMappingURL=generate-autocompletion.js.map