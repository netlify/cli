import type { ServerSettings } from './types.js';
interface StartReturnObject {
    ipVersion?: 4 | 6;
}
/**
 * Start a static server if the `useStaticServer` is provided or a framework specific server
 */
export declare const startFrameworkServer: ({ cwd, settings, }: {
    cwd: string;
    settings: ServerSettings;
}) => Promise<StartReturnObject>;
export {};
//# sourceMappingURL=framework-server.d.ts.map