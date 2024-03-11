import { chalk } from '../command-helpers.js';
import { checkGitVersion, checkHelperVersion, checkLFSFilters, checkLFSVersion } from './requirements.js';
export const checkGitVersionStep = {
    title: 'Checking Git version',
    // @ts-expect-error TS(7006) FIXME: Parameter 'ctx' implicitly has an 'any' type.
    task: async (ctx, task) => {
        const version = await checkGitVersion();
        task.title += chalk.dim(` [${version}]`);
    },
};
export const checkGitLFSVersionStep = {
    title: 'Checking Git LFS version',
    // @ts-expect-error TS(7006) FIXME: Parameter 'ctx' implicitly has an 'any' type.
    task: async (ctx, task) => {
        const version = await checkLFSVersion();
        task.title += chalk.dim(` [${version}]`);
    },
};
// @ts-expect-error TS(7006) FIXME: Parameter 'onCheckDone' implicitly has an 'any' ty... Remove this comment to see the full error message
export const checkLFSFiltersStep = (onCheckDone) => ({
    title: 'Checking Git LFS filters',
    // @ts-expect-error TS(7006) FIXME: Parameter 'ctx' implicitly has an 'any' type.
    task: async (ctx, task) => {
        const installed = await checkLFSFilters();
        return onCheckDone(ctx, task, installed);
    },
});
export const checkHelperVersionStep = {
    title: `Checking Netlify's Git Credentials version`,
    // @ts-expect-error TS(7006) FIXME: Parameter 'ctx' implicitly has an 'any' type.
    task: async (ctx, task) => {
        const version = await checkHelperVersion();
        task.title += chalk.dim(` [${version}]`);
    },
};
