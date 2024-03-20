import { dirname, extname } from 'path';
import { platform } from 'process';
import { temporaryFile } from 'tempy';
import execa from '../../../../utils/execa.js';
import { runFunctionsProxy } from '../../local-proxy.js';
const isWindows = platform === 'win32';
export const name = 'go';
// @ts-expect-error TS(7031) FIXME: Binding element 'binaryPath' implicitly has an 'an... Remove this comment to see the full error message
const build = async ({ binaryPath, functionDirectory }) => {
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
// @ts-expect-error TS(7031) FIXME: Binding element 'cwd' implicitly has an 'any' type... Remove this comment to see the full error message
const checkGoInstallation = async ({ cwd }) => {
    try {
        await execa('go', ['version'], { cwd });
        return true;
    }
    catch {
        return false;
    }
};
// @ts-expect-error TS(7031) FIXME: Binding element 'func' implicitly has an 'any' typ... Remove this comment to see the full error message
export const getBuildFunction = ({ func }) => {
    const functionDirectory = dirname(func.mainFile);
    const binaryPath = temporaryFile(isWindows ? { extension: 'exe' } : undefined);
    return () => build({ binaryPath, functionDirectory });
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
    const isSource = extname(func.mainFile) === '.go';
    return isSource ? func : null;
};
