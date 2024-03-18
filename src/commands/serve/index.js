import { Option } from 'commander';
import { normalizeContext } from '../../utils/env/index.js';
import { getGeoCountryArgParser } from '../../utils/validation.js';
export const createServeCommand = (program) => program
    .command('serve')
    .description('Build the site for production and serve locally. This does not watch the code for changes, so if you need to rebuild your site then you must exit and run `serve` again.')
    .option('--context <context>', 'Specify a deploy context or branch for environment variables (contexts: "production", "deploy-preview", "branch-deploy", "dev")', normalizeContext)
    .option('-p ,--port <port>', 'port of netlify dev', (value) => Number.parseInt(value))
    .option('-d ,--dir <path>', 'dir with static files')
    .option('-f ,--functions <folder>', 'specify a functions folder to serve')
    .option('-o ,--offline', 'disables any features that require network access')
    .addOption(new Option('--functionsPort <port>', 'Old, prefer --functions-port. Port of functions server')
    .argParser((value) => Number.parseInt(value))
    .hideHelp(true))
    .option('--functions-port <port>', 'port of functions server', (value) => Number.parseInt(value))
    .addOption(new Option('--geo <mode>', 'force geolocation data to be updated, use cached data from the last 24h if found, or use a mock location')
    .choices(['cache', 'mock', 'update'])
    .default('cache'))
    .addOption(new Option('--country <geoCountry>', 'Two-letter country code (https://ntl.fyi/country-codes) to use as mock geolocation (enables --geo=mock automatically)').argParser(getGeoCountryArgParser('netlify dev --geo=mock --country=FR')))
    .addOption(new Option('--staticServerPort <port>', 'port of the static app server used when no framework is detected')
    .argParser((value) => Number.parseInt(value))
    .hideHelp())
    .addExamples(['netlify serve', 'BROWSER=none netlify serve # disable browser auto opening'])
    .action(async (options, command) => {
    const { serve } = await import('./serve.js');
    await serve(options, command);
});
