import process from 'process';
import { isCI } from 'ci-info';
export const shouldForceFlagBeInjected = (argv) => {
    // Is the command run in a non-interactive shell or CI/CD environment?
    const scriptedCommand = Boolean(!process.stdin.isTTY || isCI || process.env.CI);
    // Is the `--force` flag not already present?
    const noForceFlag = !argv.includes('--force');
    // ENV Variable used to tests prompts in CI/CD enviroment
    const testingPrompts = process.env.TESTING_PROMPTS !== 'true';
    // Prevents prompts from blocking scripted commands
    return Boolean(scriptedCommand && testingPrompts && noForceFlag);
};
export const injectForceFlagIfScripted = (argv) => {
    if (shouldForceFlagBeInjected(argv)) {
        argv.push('--force');
    }
};
//# sourceMappingURL=scripted-commands.js.map