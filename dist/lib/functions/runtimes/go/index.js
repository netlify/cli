import { dirname, extname } from 'path';
import { platform } from 'process';
import execa from '../../../../utils/execa.js';
import { runFunctionsProxy } from '../../local-proxy.js';
import { temporaryFile } from '../../../../utils/temporary-file.js';
const isWindows = platform === 'win32';
export const name = 'go';
const build = async ({ binaryPath, functionDirectory, }) => {
    try {
        await execa('go', ['build', '-o', binaryPath], { cwd: functionDirectory });
        return { binaryPath, srcFiles: [functionDirectory] };
    }
    catch (error) {
        const isGoInstalled = await checkGoInstallation({ cwd: functionDirectory });
        if (!isGoInstalled) {
            throw new Error("You don't seem to have Go installed. Go to https://golang.org/doc/install for installation instructions.");
        }
        throw error;
    }
};
const checkGoInstallation = async ({ cwd }) => {
    try {
        await execa('go', ['version'], { cwd });
        return true;
    }
    catch {
        return false;
    }
};
export const getBuildFunction = ({ func, }) => Promise.resolve(async () => build({
    binaryPath: temporaryFile(isWindows ? { extension: 'exe' } : undefined),
    functionDirectory: dirname(func.mainFile),
}));
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
    const isSource = extname(func.mainFile) === '.go';
    return isSource ? func : null;
};
//# sourceMappingURL=index.js.map