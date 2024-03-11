#!/usr/bin/env node
// This script is run by the completion (every log output will be displayed on tab)
// src/commands/completion/completion.js -> dynamically references this file
// if this file is renamed or moved then it needs to be adapted there
import { existsSync, readFileSync } from 'fs';
import process from 'process';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'tabt... Remove this comment to see the full error message
import { log, parseEnv } from 'tabtab';
import { AUTOCOMPLETION_FILE } from './constants.js';
import getAutocompletion from './get-autocompletion.js';
/**
 * @typedef CompletionItem
 * @type import('tabtab').CompletionItem
 */
/**
 *
 * @param {import('tabtab').TabtabEnv} env
 * @param {Record<string, CompletionItem & {options: CompletionItem[]}>} program
 * @returns {CompletionItem[]|void}
 */
const env = parseEnv(process.env);
if (existsSync(AUTOCOMPLETION_FILE)) {
    const program = JSON.parse(readFileSync(AUTOCOMPLETION_FILE, 'utf-8'));
    const autocomplete = getAutocompletion(env, program);
    if (autocomplete && autocomplete.length !== 0) {
        log(autocomplete);
    }
}
