import { readFile } from 'fs/promises';
import { dirname, extname, join, resolve } from 'path';
import { platform } from 'process';
import { findUp } from 'find-up';
import toml from 'toml';
import execa from '../../../../utils/execa.js';
import { SERVE_FUNCTIONS_FOLDER } from '../../../../utils/functions/functions.js';
import { getPathInProject } from '../../../settings.js';
import { runFunctionsProxy } from '../../local-proxy.js';
const isWindows = platform === 'win32';
export const name = 'rs';
// @ts-expect-error TS(7031) FIXME: Binding element 'func' implicitly has an 'any' typ... Remove this comment to see the full error message
const build = async ({ func }) => {
    const functionDirectory = dirname(func.mainFile);
    const cacheDirectory = resolve(getPathInProject([SERVE_FUNCTIONS_FOLDER]));
    const targetDirectory = join(cacheDirectory, func.name);
    const crateName = await getCrateName(functionDirectory);
    const binaryName = `${crateName}${isWindows ? '.exe' : ''}`;
    const binaryPath = join(targetDirectory, 'debug', binaryName);
    await execa('cargo', ['build', '--target-dir', targetDirectory], {
        cwd: functionDirectory,
    });
    return {
        binaryPath,
        srcFiles: [functionDirectory],
    };
};
export const getBuildFunction = 
// @ts-expect-error TS(7031) FIXME: Binding element 'func' implicitly has an 'any' typ... Remove this comment to see the full error message
({ func }) => () => build({ func });
// @ts-expect-error TS(7006) FIXME: Parameter 'cwd' implicitly has an 'any' type.
const getCrateName = async (cwd) => {
    const manifestPath = await findUp('Cargo.toml', { cwd, type: 'file' });
    // @ts-expect-error TS(2769) FIXME: No overload matches this call.
    const manifest = await readFile(manifestPath, 'utf-8');
    const { package: CargoPackage } = toml.parse(manifest);
    return CargoPackage.name;
};
// @ts-expect-error TS(7031) FIXME: Binding element 'context' implicitly has an 'any' ... Remove this comment to see the full error message
export const invokeFunction = async ({ context, event, func, timeout }) => {
    const { stdout } = await runFunctionsProxy({
        binaryPath: func.buildData.binaryPath,
        context,
        directory: dirname(func.mainFile),
        event,
        name: func.name,
        timeout,
    });
    try {
        const { body, headers, multiValueHeaders, statusCode } = JSON.parse(stdout);
        return {
            body,
            headers,
            multiValueHeaders,
            statusCode,
        };
    }
    catch {
        return {
            statusCode: 500,
        };
    }
};
// @ts-expect-error TS(7006) FIXME: Parameter 'func' implicitly has an 'any' type.
export const onRegister = (func) => {
    const isSource = extname(func.mainFile) === '.rs';
    return isSource ? func : null;
};
