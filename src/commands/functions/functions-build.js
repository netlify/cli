import { mkdir } from 'fs/promises';
import { zipFunctions } from '@netlify/zip-it-and-ship-it';
import { NETLIFYDEVERR, NETLIFYDEVLOG, exit, log } from '../../utils/command-helpers.js';
import { getFunctionsDir } from '../../utils/functions/index.js';
export const functionsBuild = async (options, command) => {
    const { config } = command.netlify;
    const src = options.src || config.build.functionsSource;
    // @ts-expect-error TS(2554) FIXME: Expected 2 arguments, but got 1.
    const dst = getFunctionsDir({ options, config });
    if (src === dst) {
        log(`${NETLIFYDEVERR} Source and destination for function build can't be the same`);
        exit(1);
    }
    if (!src || !dst) {
        if (!src)
            log(`${NETLIFYDEVERR} Error: You must specify a source folder with a --src flag or a functionsSource field in your config`);
        if (!dst)
            log(`${NETLIFYDEVERR} Error: You must specify a destination functions folder with a --functions flag or a functions field in your config`);
        exit(1);
    }
    await mkdir(dst, { recursive: true });
    log(`${NETLIFYDEVLOG} Building functions`);
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ skipGo: boolean; }' is not ass... Remove this comment to see the full error message
    zipFunctions(src, dst, { skipGo: true });
    log(`${NETLIFYDEVLOG} Functions built to `, dst);
};
