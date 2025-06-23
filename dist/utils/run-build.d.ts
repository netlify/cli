import BaseCommand from '../commands/base-command.js';
import { $TSFixMe } from '../commands/types.js';
import { ServerSettings } from './types.js';
export declare const runNetlifyBuild: ({ command, env, options, settings, timeline, }: {
    command: BaseCommand;
    options: $TSFixMe;
    settings: ServerSettings;
    env: NodeJS.ProcessEnv;
    timeline: "build" | "dev";
}) => Promise<{
    configPath: string;
    configMutations?: undefined;
} | {
    configMutations: any;
    configPath?: undefined;
}>;
type RunTimelineOptions = Omit<Parameters<typeof runNetlifyBuild>[0], 'timeline'>;
export declare const runDevTimeline: (options: RunTimelineOptions) => Promise<{
    configPath: string;
    configMutations?: undefined;
} | {
    configMutations: any;
    configPath?: undefined;
}>;
export declare const runBuildTimeline: (options: RunTimelineOptions) => Promise<{
    configPath: string;
    configMutations?: undefined;
} | {
    configMutations: any;
    configPath?: undefined;
}>;
export {};
//# sourceMappingURL=run-build.d.ts.map