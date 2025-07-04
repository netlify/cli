#!/usr/bin/env node
// This script is run by the completion (every log output will be displayed on tab)
// src/commands/completion/completion.js -> dynamically references this file
// if this file is renamed or moved then it needs to be adapted there
import { existsSync, readFileSync } from 'fs';
import process from 'process';
import { getShellFromEnv, log, parseEnv } from '@pnpm/tabtab';
import { AUTOCOMPLETION_FILE } from './constants.js';
import getAutocompletion from './get-autocompletion.js';
const env = parseEnv(process.env);
const shell = getShellFromEnv(process.env);
if (existsSync(AUTOCOMPLETION_FILE)) {
    const program = JSON.parse(readFileSync(AUTOCOMPLETION_FILE, 'utf-8'));
    const autocomplete = getAutocompletion(env, program);
    if (autocomplete && autocomplete.length !== 0) {
        log(autocomplete, shell);
    }
}
//# sourceMappingURL=script.js.map