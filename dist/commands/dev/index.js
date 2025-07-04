import { Option } from 'commander';
import terminalLink from 'terminal-link';
import { BANG, chalk } from '../../utils/command-helpers.js';
import { normalizeContext } from '../../utils/env/index.js';
import { getGeoCountryArgParser } from '../../utils/validation.js';
const validateShortFlagArgs = (args) => {
    if (args.startsWith('=')) {
        throw new Error(`Short flag options like -e or -E don't support the '=' sign
 ${chalk.red(BANG)}   Supported formats:
      netlify dev -e
      netlify dev -e 127.0.0.1:9229
      netlify dev -e127.0.0.1:9229
      netlify dev -E
      netlify dev -E 127.0.0.1:9229
      netlify dev -E127.0.0.1:9229`);
    }
    return args;
};
export const createDevCommand = (program) => {
    return program
        .command('dev')
        .alias('develop')
        .description(`Local dev server\nThe dev command will run a local dev server with Netlify's proxy and redirect rules`)
        .option('-c ,--command <command>', 'command to run')
        .option('--context <context>', 'Specify a deploy context for environment variables (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: dev)', normalizeContext)
        .option('-p ,--port <port>', 'port of netlify dev', (value) => Number.parseInt(value))
        .addOption(new Option('--skip-wait-port', 'disables waiting for target port to become available').hideHelp(true))
        .addOption(new Option('--no-open', 'disables the automatic opening of a browser window'))
        .option('--target-port <port>', 'port of target app server', (value) => Number.parseInt(value))
        .option('--framework <name>', 'framework to use. Defaults to #auto which automatically detects a framework')
        .option('-d ,--dir <path>', 'dir with static files')
        .option('-f ,--functions <folder>', 'specify a functions folder to serve')
        .option('-o, --offline', 'Disables any features that require network access')
        .addOption(new Option('--offline-env', 'disables fetching environment variables from the Netlify API').hideHelp(true))
        .addOption(new Option('--internal-disable-edge-functions', "disables edge functions. use this if your environment doesn't support Deno. This option is internal and should not be used by end users.").hideHelp(true))
        .option('-l, --live [subdomain]', 'start a public live session; optionally, supply a subdomain to generate a custom URL', false)
        .option('--functions-port <port>', 'port of functions server', (value) => Number.parseInt(value))
        .addOption(new Option('--geo <mode>', 'force geolocation data to be updated, use cached data from the last 24h if found, or use a mock location')
        .choices(['cache', 'mock', 'update'])
        .default('cache'))
        .addOption(new Option('--country <geoCountry>', 'Two-letter country code (https://ntl.fyi/country-codes) to use as mock geolocation (enables --geo=mock automatically)').argParser(getGeoCountryArgParser('netlify dev --geo=mock --country=FR')))
        .addOption(new Option('--staticServerPort <port>', 'port of the static app server used when no framework is detected')
        .argParser((value) => Number.parseInt(value))
        .hideHelp())
        .addOption(new Option('-e, --edge-inspect [address]', 'enable the V8 Inspector Protocol for Edge Functions, with an optional address in the host:port format')
        .conflicts('edgeInspectBrk')
        .argParser(validateShortFlagArgs))
        .addOption(new Option('-E, --edge-inspect-brk [address]', 'enable the V8 Inspector Protocol for Edge Functions and pause execution on the first line of code, with an optional address in the host:port format')
        .conflicts('edgeInspect')
        .argParser(validateShortFlagArgs))
        .addExamples([
        'netlify dev',
        'netlify dev -d public',
        'netlify dev -c "hugo server -w" --target-port 1313',
        'netlify dev --context production # Use env var values from production context',
        'netlify dev --context deploy-preview # Use env var values from deploy-preview context',
        'netlify dev --context branch:feat/make-it-pop # Use env var values from the feat/make-it-pop branch context or branch-deploy context',
        'netlify dev --edge-inspect',
        'netlify dev --edge-inspect=127.0.0.1:9229',
        'netlify dev --edge-inspect-brk',
        'netlify dev --edge-inspect-brk=127.0.0.1:9229',
        'BROWSER=none netlify dev # disable browser auto opening',
    ])
        .addHelpText('after', () => {
        const docsUrl = 'https://docs.netlify.com/cli/local-development/';
        return `
For more information about Netlify local development, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`;
    })
        .action(async (options, command) => {
        const { dev } = await import('./dev.js');
        await dev(options, command);
    });
};
//# sourceMappingURL=index.js.map