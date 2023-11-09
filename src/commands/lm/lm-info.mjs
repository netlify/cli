import { Listr } from 'listr2';
import { checkGitLFSVersionStep, checkGitVersionStep, checkHelperVersionStep, checkLFSFiltersStep, } from '../../utils/lm/steps.mjs';
/**
 * The lm:info command
 */
const lmInfo = async () => {
    const steps = [
        checkGitVersionStep,
        checkGitLFSVersionStep,
        // @ts-expect-error TS(7006) FIXME: Parameter 'ctx' implicitly has an 'any' type.
        checkLFSFiltersStep((ctx, task, installed) => {
            if (!installed) {
                throw new Error('Git LFS filters are not installed, run `git lfs install` to install them');
            }
        }),
        checkHelperVersionStep,
    ];
    const tasks = new Listr(steps, { concurrent: true, exitOnError: false });
    try {
        await tasks.run();
    }
    catch {
        // an error is already reported when a task fails
    }
};
/**
 * Creates the `netlify lm:info` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createLmInfoCommand = (program) => program.command('lm:info', { hidden: true }).description('Show large media requirements information.').action(lmInfo);
