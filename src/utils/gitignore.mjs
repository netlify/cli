import { readFile, writeFile } from 'fs/promises';
import path from 'path';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'pars... Remove this comment to see the full error message
import parseIgnore from 'parse-gitignore';
import { fileExistsAsync } from '../lib/fs.mjs';
import { log } from './command-helpers.mjs';
// @ts-expect-error TS(7006) FIXME: Parameter 'dir' implicitly has an 'any' type.
const hasGitIgnore = async function (dir) {
    const gitIgnorePath = path.join(dir, '.gitignore');
    const hasIgnore = await fileExistsAsync(gitIgnorePath);
    return hasIgnore;
};
// @ts-expect-error TS(7006) FIXME: Parameter 'dir' implicitly has an 'any' type.
export const ensureNetlifyIgnore = async function (dir) {
    const gitIgnorePath = path.join(dir, '.gitignore');
    const ignoreContent = '# Local Netlify folder\n.netlify\n';
    /* No .gitignore file. Create one and ignore .netlify folder */
    if (!(await hasGitIgnore(dir))) {
        await writeFile(gitIgnorePath, ignoreContent, 'utf8');
        return false;
    }
    let gitIgnoreContents;
    let ignorePatterns;
    try {
        gitIgnoreContents = await readFile(gitIgnorePath, 'utf8');
        ignorePatterns = parseIgnore.parse(gitIgnoreContents);
    }
    catch {
        // ignore
    }
    /* Not ignoring .netlify folder. Add to .gitignore */
    // @ts-expect-error TS(7006) FIXME: Parameter 'pattern' implicitly has an 'any' type.
    if (!ignorePatterns || !ignorePatterns.patterns.some((pattern) => /(^|\/|\\)\.netlify($|\/|\\)/.test(pattern))) {
        log();
        log('Adding local .netlify folder to .gitignore file...');
        const newContents = `${gitIgnoreContents}\n${ignoreContent}`;
        await writeFile(gitIgnorePath, newContents, 'utf8');
    }
};
