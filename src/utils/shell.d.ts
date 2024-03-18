import execa from 'execa';
/**
 * @param {() => Promise<void>} job
 */
export declare const addCleanupJob: (job: any) => void;
/**
 * Run a command and pipe stdout, stderr and stdin
 * @param {string} command
 * @param {object} options
 * @param {import('ora').Ora|null} [options.spinner]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {string} [options.cwd]
 * @returns {execa.ExecaChildProcess<string>}
 */
export declare const runCommand: (command: any, options?: {}) => execa.ExecaChildProcess<string>;
//# sourceMappingURL=shell.d.ts.map