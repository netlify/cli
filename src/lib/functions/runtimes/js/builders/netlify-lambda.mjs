import { readFile } from 'fs/promises';
import { resolve } from 'path';
import minimist from 'minimist';
// @ts-expect-error TS(7034) FIXME: Variable 'execa' implicitly has type 'any' in some... Remove this comment to see the full error message
import execa from '../../../../../utils/execa.mjs';
import { fileExistsAsync } from '../../../../fs.mjs';
import { memoizedBuild } from '../../../memoized-build.mjs';
// @ts-expect-error TS(2525) FIXME: Initializer provides no value for this binding ele... Remove this comment to see the full error message
export const detectNetlifyLambda = async function ({ packageJson } = {}) {
    const { dependencies, devDependencies, scripts } = packageJson || {};
    if (!((dependencies && dependencies['netlify-lambda']) || (devDependencies && devDependencies['netlify-lambda']))) {
        return false;
    }
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    const matchingScripts = Object.entries(scripts).filter(([, script]) => script.match(/netlify-lambda\s+build/));
    for (const [key, script] of matchingScripts) {
        // E.g. ["netlify-lambda", "build", "functions/folder"]
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        const match = minimist(script.split(' '), {
            // these are all valid options for netlify-lambda
            boolean: ['s', 'static'],
            string: ['c', 'config', 'p', 'port', 'b', 'babelrc', 't', 'timeout'],
        });
        // We are not interested in 'netlify-lambda' and 'build' commands
        const functionDirectories = match._.slice(2);
        if (functionDirectories.length === 1) {
            const srcFiles = [resolve(functionDirectories[0])];
            const yarnExists = await fileExistsAsync('yarn.lock');
            // @ts-expect-error TS(7005) FIXME: Variable 'execa' implicitly has an 'any' type.
            const buildCommand = () => execa(yarnExists ? 'yarn' : 'npm', ['run', key]);
            return {
                build: async ({ cache = {} } = {}) => {
                    await memoizedBuild({ cache, cacheKey: `netlify-lambda-${key}`, command: buildCommand });
                    return {
                        srcFiles,
                    };
                },
                builderName: 'netlify-lambda',
                // Currently used for tests only.
                npmScript: key,
            };
        }
        if (functionDirectories.length === 0) {
            console.warn(`Command 'netlify-lambda build' was detected in script '${key}', but contained no functions folder`);
        }
        else {
            console.warn(`Command 'netlify-lambda build' was detected in script '${key}', but contained 2 or more function folders`);
        }
    }
    return false;
};
export default async function handler() {
    const exists = await fileExistsAsync('package.json');
    if (!exists) {
        return false;
    }
    const content = await readFile('package.json', 'utf-8');
    const packageJson = JSON.parse(content);
    return detectNetlifyLambda({ packageJson });
}
