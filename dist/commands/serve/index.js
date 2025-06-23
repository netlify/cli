import { Option } from 'commander';
import { normalizeContext } from '../../utils/env/index.js';
import { getGeoCountryArgParser } from '../../utils/validation.js';
export const createServeCommand = (program) => program
    .command('serve')
    .description('Build the project for production and serve locally. This does not watch the code for changes, so if you need to rebuild your project then you must exit and run `serve` again.')
    .option('--context <context>', 'Specify a deploy context for environment variables (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: dev)', normalizeContext)
    .option('-p ,--port <port>', 'port of netlify dev', (value) => Number.parseInt(value))
    .option('-d ,--dir <path>', 'dir with static files')
    .option('-f ,--functions <folder>', 'specify a functions folder to serve')
    .option('-o, --offline', 'Disables any features that require network access')
    .addOption(new Option('--internal-disable-edge-functions', "disables edge functions. use this if your environment doesn't support Deno. This option is internal and should not be used by end users.").hideHelp(true))
    .option('--functions-port <port>', 'port of functions server', (value) => Number.parseInt(value))
    .addOption(new Option('--geo <mode>', 'force geolocation data to be updated, use cached data from the last 24h if found, or use a mock location')
    .choices(['cache', 'mock', 'update'])
    .default('cache'))
    .addOption(new Option('--country <geoCountry>', 'Two-letter country code (https://ntl.fyi/country-codes) to use as mock geolocation (enables --geo=mock automatically)').argParser(getGeoCountryArgParser('netlify dev --geo=mock --country=FR')))
    .addOption(new Option('--staticServerPort <port>', 'port of the static app server used when no framework is detected')
    .argParser((value) => Number.parseInt(value))
    .hideHelp())
    .addExamples([
    'netlify serve',
    'BROWSER=none netlify serve # disable browser auto opening',
    'netlify serve --context production # Use env var values from production context',
    'netlify serve --context deploy-preview # Use env var values from deploy-preview context',
    'netlify serve --context branch:feat/make-it-pop # Use env var values from the feat/make-it-pop branch context or branch-deploy context',
])
    .action(async (options, command) => {
    const { serve } = await import('./serve.js');
    await serve(options, command);
});
//# sourceMappingURL=index.js.map