import execa from './execa.js';
export const runGit = async (args, quiet) => {
    await execa('git', args, {
        ...(quiet ? {} : { stdio: 'inherit' }),
    });
};
//# sourceMappingURL=run-git.js.map