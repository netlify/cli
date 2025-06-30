import path from 'path';
import process from 'process';
import { fetchLatest, fetchVersion, newerVersion, updateAvailable } from 'gh-release-fetch';
import { isexe } from 'isexe';
import { NETLIFYDEVWARN, logAndThrowError, getTerminalLink, log } from '../utils/command-helpers.js';
import execa from '../utils/execa.js';
const isWindows = () => process.platform === 'win32';
const getRepository = ({ packageName }) => `netlify/${packageName}`;
export const getExecName = ({ execName }) => (isWindows() ? `${execName}.exe` : execName);
const getOptions = () => {
    // this is used in out CI tests to avoid hitting GitHub API limit
    // when calling gh-release-fetch
    if (process.env.NETLIFY_TEST_GITHUB_TOKEN) {
        return {
            headers: { Authorization: `token ${process.env.NETLIFY_TEST_GITHUB_TOKEN}` },
        };
    }
};
const isVersionOutdated = async ({ currentVersion, latestVersion, packageName, }) => {
    if (latestVersion) {
        return newerVersion(latestVersion, currentVersion);
    }
    const options = getOptions();
    const outdated = await updateAvailable(getRepository({ packageName }), currentVersion, options);
    return outdated;
};
export const shouldFetchLatestVersion = async ({ binPath, execArgs, execName, latestVersion, packageName, pattern, }) => {
    const execPath = path.join(binPath, getExecName({ execName }));
    const exists = await isexe(execPath, { ignoreErrors: true });
    if (!exists) {
        return true;
    }
    const { stdout } = await execa(execPath, execArgs);
    if (!stdout) {
        return false;
    }
    const match = stdout.match(new RegExp(pattern));
    if (!match) {
        return false;
    }
    try {
        const [, currentVersion] = match;
        const outdated = await isVersionOutdated({
            packageName,
            currentVersion,
            latestVersion,
        });
        return outdated;
    }
    catch (error_) {
        if (exists) {
            log(NETLIFYDEVWARN, `failed checking for new version of '${packageName}'. Using existing version`);
            return false;
        }
        throw error_;
    }
};
export const getArch = () => {
    switch (process.arch) {
        case 'x64':
            return 'amd64';
        case 'ia32':
            return '386';
        default:
            return process.arch;
    }
};
export const fetchLatestVersion = async ({ destination, execName, extension, latestVersion, packageName, }) => {
    const win = isWindows();
    const arch = getArch();
    const platform = win ? 'windows' : process.platform;
    const pkgName = `${execName}-${platform}-${arch}.${extension}`;
    const release = {
        repository: getRepository({ packageName }),
        package: pkgName,
        destination,
        extract: true,
    };
    const options = getOptions();
    const fetch = latestVersion
        ? // @ts-expect-error(serhalp) -- Either `gh-release-fetch` is not typed correctly or `options.headers` is useless
            fetchVersion({ ...release, version: latestVersion }, options)
        : // @ts-expect-error(serhalp) -- Either `gh-release-fetch` is not typed correctly or `options.version` should be passed
            fetchLatest(release, options);
    try {
        await fetch;
    }
    catch (error_) {
        if (error_ != null && typeof error_ === 'object' && 'statusCode' in error_ && error_.statusCode === 404) {
            const createIssueLink = new URL('https://github.com/netlify/cli/issues/new');
            createIssueLink.searchParams.set('assignees', '');
            createIssueLink.searchParams.set('labels', 'type: bug');
            createIssueLink.searchParams.set('template', 'bug_report.md');
            createIssueLink.searchParams.set('title', `${execName} is not supported on ${platform} with CPU architecture ${arch}`);
            const issueLink = getTerminalLink('Create a new CLI issue', createIssueLink.href);
            return logAndThrowError(`The operating system ${platform} with the CPU architecture ${arch} is currently not supported!

Please open up an issue on our CLI repository so that we can support it:
${issueLink}`);
        }
        return logAndThrowError(error_);
    }
};
//# sourceMappingURL=exec-fetcher.js.map