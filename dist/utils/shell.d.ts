import execa from 'execa';
import { type Spinner } from '../lib/spinner.js';
export declare const runCommand: (command: string, options: {
    spinner?: Spinner;
    env?: NodeJS.ProcessEnv;
    cwd: string;
}) => execa.ExecaChildProcess<string>;
//# sourceMappingURL=shell.d.ts.map