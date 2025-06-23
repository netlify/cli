import process from 'process';
import { Transform } from 'stream';
import { stripVTControlCharacters } from 'util';
import execa from 'execa';
import { chalk, log, NETLIFYDEVERR, NETLIFYDEVWARN } from './command-helpers.js';
import { processOnExit } from './dev.js';
const isErrnoException = (value) => value instanceof Error && Object.hasOwn(value, 'code');
const createStripAnsiControlCharsStream = () => new Transform({
    transform(chunk, _encoding, callback) {
        callback(null, stripVTControlCharacters(typeof chunk === 'string' ? chunk : chunk?.toString() ?? ''));
    },
});
const cleanupWork = [];
let cleanupStarted = false;
const cleanupBeforeExit = async ({ exitCode } = {}) => {
    // If cleanup has started, then wherever started it will be responsible for exiting
    if (!cleanupStarted) {
        cleanupStarted = true;
        try {
            await Promise.all(cleanupWork.map((cleanup) => cleanup()));
        }
        finally {
            // eslint-disable-next-line n/no-process-exit
            process.exit(exitCode);
        }
    }
};
// TODO(serhalp): Move (or at least rename). This sounds like a generic shell util but it's specific
// to `netlify dev`...
export const runCommand = (command, options) => {
    const { cwd, env = {}, spinner } = options;
    const commandProcess = execa.command(command, {
        preferLocal: true,
        // we use reject=false to avoid rejecting synchronously when the command doesn't exist
        reject: false,
        env: {
            // we want always colorful terminal outputs
            FORCE_COLOR: 'true',
            ...env,
        },
        // windowsHide needs to be false for child process to terminate properly on Windows
        windowsHide: false,
        cwd,
    });
    // Ensure that an active spinner stays at the bottom of the commandline
    // even though the actual framework command might be outputting stuff
    const pipeDataWithSpinner = (writeStream, chunk) => {
        // Clear the spinner, write the framework command line, then resume spinning
        if (spinner?.isSpinning()) {
            spinner.clear();
        }
        writeStream.write(chunk, () => {
            if (spinner?.isSpinning()) {
                spinner.spin();
            }
        });
    };
    commandProcess.stdout
        ?.pipe(createStripAnsiControlCharsStream())
        .on('data', pipeDataWithSpinner.bind(null, process.stdout));
    commandProcess.stderr
        ?.pipe(createStripAnsiControlCharsStream())
        .on('data', pipeDataWithSpinner.bind(null, process.stderr));
    if (commandProcess.stdin != null) {
        process.stdin.pipe(commandProcess.stdin);
    }
    // we can't try->await->catch since we don't want to block on the framework server which
    // is a long running process
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    commandProcess.then(async () => {
        const result = await commandProcess;
        const [commandWithoutArgs] = command.split(' ');
        if (result.failed && isNonExistingCommandError({ command: commandWithoutArgs, error: result })) {
            log(`${NETLIFYDEVERR} Failed running command: ${command}. Please verify ${chalk.magenta(`'${commandWithoutArgs}'`)} exists`);
        }
        else {
            const errorMessage = result.failed
                ? // @ts-expect-error FIXME(serhalp): We use `reject: false` which means the resolved value is either the resolved value
                    // or the rejected value, but the types aren't smart enough to know this.
                    `${NETLIFYDEVERR} ${result.shortMessage}`
                : `${NETLIFYDEVWARN} "${command}" exited with code ${result.exitCode.toString()}`;
            log(`${errorMessage}. Shutting down Netlify Dev server`);
        }
        await cleanupBeforeExit({ exitCode: 1 });
    });
    processOnExit(async () => {
        await cleanupBeforeExit({});
    });
    return commandProcess;
};
const isNonExistingCommandError = ({ command, error: commandError }) => {
    // `ENOENT` is only returned for non Windows systems
    // See https://github.com/sindresorhus/execa/pull/447
    if (isErrnoException(commandError) && commandError.code === 'ENOENT') {
        return true;
    }
    // if the command is a package manager we let it report the error
    if (['yarn', 'npm', 'pnpm'].includes(command)) {
        return false;
    }
    // this only works on English versions of Windows
    return (commandError instanceof Error &&
        typeof commandError.message === 'string' &&
        commandError.message.includes('is not recognized as an internal or external command'));
};
//# sourceMappingURL=shell.js.map