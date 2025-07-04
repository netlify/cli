import fs from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import { install, uninstall } from '@pnpm/tabtab';
import { generateAutocompletion } from '../../lib/completion/index.js';
import { logAndThrowError, log, chalk, checkFileForLine, TABTAB_CONFIG_LINE, AUTOLOAD_COMPINIT, } from '../../utils/command-helpers.js';
const completer = join(dirname(fileURLToPath(import.meta.url)), '../../lib/completion/script.js');
export const completionGenerate = async (_options, command) => {
    const { parent } = command;
    if (!parent) {
        return logAndThrowError(`There has been an error generating the completion script.`);
    }
    generateAutocompletion(parent);
    await install({
        name: parent.name(),
        completer,
    });
    const completionScriptPath = join(homedir(), `.config/tabtab/${parent.name()}.zsh`);
    if (fs.existsSync(completionScriptPath)) {
        let completionScript = fs.readFileSync(completionScriptPath, 'utf8');
        completionScript = completionScript.replace(/compdef _netlify_completion netlify/, 'compdef _netlify_completion netlify ntl');
        fs.writeFileSync(completionScriptPath, completionScript, 'utf8');
        log(`Added alias 'ntl' to completion script.`);
    }
    const zshConfigFilepath = join(process.env.HOME || homedir(), '.zshrc');
    if (fs.existsSync(zshConfigFilepath) &&
        checkFileForLine(zshConfigFilepath, TABTAB_CONFIG_LINE) &&
        !checkFileForLine(zshConfigFilepath, AUTOLOAD_COMPINIT)) {
        log(`To enable Tabtab autocompletion with zsh, the following line may need to be added to your ~/.zshrc:`);
        log(chalk.bold.cyan(`\n${AUTOLOAD_COMPINIT}\n`));
        const { compinitAdded } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'compinitAdded',
                message: `Would you like to add it?`,
                default: true,
            },
        ]);
        if (compinitAdded) {
            fs.readFile(zshConfigFilepath, 'utf8', (_err, data) => {
                const updatedZshFile = AUTOLOAD_COMPINIT + '\n' + data;
                fs.writeFileSync(zshConfigFilepath, updatedZshFile, 'utf8');
            });
            log('Successfully added compinit line to .zshrc');
        }
    }
    log(`Completion for ${parent.name()} successfully installed!`);
    if (process.platform !== 'win32') {
        log("\nTo ensure proper functionality, you'll need to set appropriate file permissions.");
        log(chalk.bold('Add executable permissions by running the following command:'));
        log(chalk.bold.cyan(`\nchmod +x ${completer}\n`));
    }
    else {
        log(`\nTo ensure proper functionality, you may need to set appropriate file permissions to ${completer}.`);
    }
};
export const completionUninstall = async (_options, command) => {
    if (!command.parent) {
        return logAndThrowError(`There has been an error deleting the completion script.`);
    }
    await uninstall({
        name: command.parent.name(),
    });
};
//# sourceMappingURL=completion.js.map