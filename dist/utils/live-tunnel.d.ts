import type CLIState from './cli-state.js';
export declare const startLiveTunnel: ({ localPort, netlifyApiToken, siteId, slug, }: {
    localPort: number;
    netlifyApiToken?: string | null | undefined;
    siteId?: string | undefined;
    slug: string;
}) => Promise<string>;
export declare const getLiveTunnelSlug: (state: CLIState, override?: string) => string;
//# sourceMappingURL=live-tunnel.d.ts.map