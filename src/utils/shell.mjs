import process from 'process';
import execa from 'execa';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'stri... Remove this comment to see the full error message
import stripAnsiCc from 'strip-ansi-control-characters';
import { chalk, log, NETLIFYDEVERR, NETLIFYDEVWARN } from './command-helpers.mjs';
import { processOnExit } from './dev.mjs';
/**
 * @type {(() => Promise<void>)[]} - array of functions to run before the process exits
 */
// @ts-expect-error TS(7034) FIXME: Variable 'cleanupWork' implicitly has type 'any[]'... Remove this comment to see the full error message
const cleanupWork = [];
let cleanupStarted = false;
/**
 * @param {() => Promise<void>} job
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'job' implicitly has an 'any' type.
export const addCleanupJob = (job) => {
    cleanupWork.push(job);
};
/**
 * @param {object} input
 * @param {number=} input.exitCode The exit code to return when exiting the process after cleanup
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'exitCode' implicitly has an 'any'... Remove this comment to see the full error message
const cleanupBeforeExit = async ({ exitCode }) => {
    // If cleanup has started, then wherever started it will be responsible for exiting
    if (!cleanupStarted) {
        cleanupStarted = true;
        try {
            // @ts-expect-error TS(7005) FIXME: Variable 'cleanupWork' implicitly has an 'any[]' t... Remove this comment to see the full error message
            await Promise.all(cleanupWork.map((cleanup) => cleanup()));
        }
        finally {
            process.exit(exitCode);
        }
    }
};
/**
 * Run a command and pipe stdout, stderr and stdin
 * @param {string} command
 * @param {object} options
 * @param {import('ora').Ora|null} [options.spinner]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {string} [options.cwd]
 * @returns {execa.ExecaChildProcess<string>}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
export const runCommand = (command, options = {}) => {
    // @ts-expect-error TS(2339) FIXME: Property 'cwd' does not exist on type '{}'.
    const { cwd, env = {}, spinner = null } = options;
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
    // This ensures that an active spinner stays at the bottom of the commandline
    // even though the actual framework command might be outputting stuff
    // @ts-expect-error TS(7006) FIXME: Parameter 'writeStream' implicitly has an 'any' ty... Remove this comment to see the full error message
    const pipeDataWithSpinner = (writeStream, chunk) => {
        if (spinner && spinner.isSpinning) {
            spinner.clear();
            spinner.isSilent = true;
        }
        writeStream.write(chunk, () => {
            if (spinner && spinner.isSpinning) {
                spinner.isSilent = false;
                spinner.render();
            }
        });
    };
    // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
    commandProcess.stdout.pipe(stripAnsiCc.stream()).on('data', pipeDataWithSpinner.bind(null, process.stdout));
    // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
    commandProcess.stderr.pipe(stripAnsiCc.stream()).on('data', pipeDataWithSpinner.bind(null, process.stderr));
    // @ts-expect-error TS(2345) FIXME: Argument of type 'Writable | null' is not assignab... Remove this comment to see the full error message
    process.stdin.pipe(commandProcess.stdin);
    // we can't try->await->catch since we don't want to block on the framework server which
    // is a long running process
    // eslint-disable-next-line promise/catch-or-return
    commandProcess
        // eslint-disable-next-line promise/prefer-await-to-then
        .then(async () => {
        const result = await commandProcess;
        const [commandWithoutArgs] = command.split(' ');
        if (result.failed && isNonExistingCommandError({ command: commandWithoutArgs, error: result })) {
            log(`${NETLIFYDEVERR} Failed running command: ${command}. Please verify ${chalk.magenta(`'${commandWithoutArgs}'`)} exists`);
        }
        else {
            const errorMessage = result.failed
                // @ts-expect-error TS(2339) FIXME: Property 'shortMessage' does not exist on type 'Ex... Remove this comment to see the full error message
                ? `${NETLIFYDEVERR} ${result.shortMessage}`
                : `${NETLIFYDEVWARN} "${command}" exited with code ${result.exitCode}`;
            log(`${errorMessage}. Shutting down Netlify Dev server`);
        }
        return await cleanupBeforeExit({ exitCode: 1 });
    });
    // @ts-expect-error TS(2345) FIXME: Argument of type '{}' is not assignable to paramet... Remove this comment to see the full error message
    processOnExit(async () => await cleanupBeforeExit({}));
    return commandProcess;
};
/**
 *
 * @param {object} config
 * @param {string} config.command
 * @param {*} config.error
 * @returns
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'command' implicitly has an 'any' ... Remove this comment to see the full error message
const isNonExistingCommandError = ({ command, error: commandError }) => {
    // `ENOENT` is only returned for non Windows systems
    // See https://github.com/sindresorhus/execa/pull/447
    if (commandError.code === 'ENOENT') {
        return true;
    }
    // if the command is a package manager we let it report the error
    if (['yarn', 'npm', 'pnpm'].includes(command)) {
        return false;
    }
    // this only works on English versions of Windows
    return (typeof commandError.message === 'string' &&
        commandError.message.includes('is not recognized as an internal or external command'));
};
