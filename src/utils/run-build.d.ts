/**
 * @param {object} params
 * @param {import('../commands/base-command.js').default} params.command
 * @param {import('../commands/base-command.js').default} params.command
 * @param {*} params.options The flags of the command
 * @param {import('./types.js').ServerSettings} params.settings
 * @param {NodeJS.ProcessEnv} [params.env]
 * @param {'build' | 'dev'} [params.timeline]
 * @returns
 */
export declare const runNetlifyBuild: ({ command, env, options, settings, timeline }: {
    command: any;
    env?: {} | undefined;
    options: any;
    settings: any;
    timeline?: string | undefined;
}) => Promise<{
    configPath?: undefined;
} | {
    configPath: string;
}>;
/**
 * @param {Omit<Parameters<typeof runNetlifyBuild>[0], 'timeline'>} options
 */
export declare const runDevTimeline: (options: any) => Promise<{
    configPath?: undefined;
} | {
    configPath: string;
}>;
/**
 * @param {Omit<Parameters<typeof runNetlifyBuild>[0], 'timeline'>} options
 */
export declare const runBuildTimeline: (options: any) => Promise<{
    configPath?: undefined;
} | {
    configPath: string;
}>;
//# sourceMappingURL=run-build.d.ts.map