import fs from 'fs';
import path from 'path';
import process from 'process';
import { deleteProperty, getProperty, hasProperty, setProperty } from 'dot-prop';
import { findUpSync } from 'find-up';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'writ... Remove this comment to see the full error message
import writeFileAtomic from 'write-file-atomic';
import { getPathInProject } from '../lib/settings.js';
const STATE_PATH = getPathInProject(['state.json']);
const permissionError = "You don't have access to this file.";
/**
 * Finds location of `.netlify/state.json`
 * @param {string} cwd
 * @returns {string}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'cwd' implicitly has an 'any' type.
const findStatePath = (cwd) => {
    const statePath = findUpSync([STATE_PATH], { cwd });
    if (!statePath) {
        return path.join(cwd, STATE_PATH);
    }
    return statePath;
};
export default class StateConfig {
    // @ts-expect-error TS(7006) FIXME: Parameter 'cwd' implicitly has an 'any' type.
    constructor(cwd) {
        // @ts-expect-error TS(2339) FIXME: Property 'path' does not exist on type 'StateConfi... Remove this comment to see the full error message
        this.path = findStatePath(cwd);
    }
    get all() {
        try {
            // @ts-expect-error TS(2345) FIXME: Argument of type 'Buffer' is not assignable to par... Remove this comment to see the full error message
            return JSON.parse(fs.readFileSync(this.path));
        }
        catch (error) {
            // Don't create if it doesn't exist
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
                return {};
            }
            // Improve the message of permission errors
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            if (error.code === 'EACCES') {
                // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
                error.message = `${error.message}\n${permissionError}\n`;
            }
            // Empty the file if it encounters invalid JSON
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            if (error.name === 'SyntaxError') {
                // @ts-expect-error TS(2339) FIXME: Property 'path' does not exist on type 'StateConfi... Remove this comment to see the full error message
                writeFileAtomic.sync(this.path, '');
                return {};
            }
            throw error;
        }
    }
    set all(val) {
        try {
            // Make sure the folder exists as it could have been deleted in the meantime
            // @ts-expect-error TS(2339) FIXME: Property 'path' does not exist on type 'StateConfi... Remove this comment to see the full error message
            fs.mkdirSync(path.dirname(this.path), { recursive: true });
            // @ts-expect-error TS(2339) FIXME: Property 'path' does not exist on type 'StateConfi... Remove this comment to see the full error message
            writeFileAtomic.sync(this.path, JSON.stringify(val, null, '\t'));
        }
        catch (error) {
            // Improve the message of permission errors
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            if (error.code === 'EACCES') {
                // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
                error.message = `${error.message}\n${permissionError}\n`;
            }
            throw error;
        }
    }
    get size() {
        return Object.keys(this.all || {}).length;
    }
    // @ts-expect-error TS(7006) FIXME: Parameter 'key' implicitly has an 'any' type.
    get(key) {
        if (key === 'siteId' && process.env.NETLIFY_SITE_ID) {
            // TODO figure out cleaner way of grabbing ENV vars
            return process.env.NETLIFY_SITE_ID;
        }
        return getProperty(this.all, key);
    }
    // @ts-expect-error TS(7019) FIXME: Rest parameter 'args' implicitly has an 'any[]' ty... Remove this comment to see the full error message
    set(...args) {
        const [key, val] = args;
        const config = this.all;
        if (args.length === 1) {
            Object.entries(key).forEach(([keyPart, value]) => {
                setProperty(config, keyPart, value);
            });
        }
        else {
            setProperty(config, key, val);
        }
        this.all = config;
    }
    // @ts-expect-error TS(7006) FIXME: Parameter 'key' implicitly has an 'any' type.
    has(key) {
        return hasProperty(this.all, key);
    }
    // @ts-expect-error TS(7006) FIXME: Parameter 'key' implicitly has an 'any' type.
    delete(key) {
        const config = this.all;
        deleteProperty(config, key);
        this.all = config;
    }
    clear() {
        this.all = {};
    }
}
