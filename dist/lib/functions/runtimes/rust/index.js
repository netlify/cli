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
export const getBuildFunction = ({ func, }) => Promise.resolve(async () => build({ func }));
const getCrateName = async (cwd) => {
    const manifestPath = await findUp('Cargo.toml', { cwd, type: 'file' });
    if (!manifestPath) {
        throw new Error('Cargo.toml not found');
    }
    const parsedManifest = toml.parse(await readFile(manifestPath, 'utf-8'));
    // TODO(serhalp): Also validate `.package.name`?
    if (parsedManifest == null || typeof parsedManifest !== 'object' || !('package' in parsedManifest)) {
        throw new Error('Cargo.toml is missing or invalid');
    }
    const { package: CargoPackage } = parsedManifest;
    return CargoPackage.name;
};
export const invokeFunction = async ({ context, event, func, timeout }) => {
    if (func.buildData == null) {
        throw new Error('Cannot invoke a function that has not been built');
    }
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
export const onRegister = (func) => {
    const isSource = extname(func.mainFile) === '.rs';
    return isSource ? func : null;
};
//# sourceMappingURL=index.js.map