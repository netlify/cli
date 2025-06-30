/**
 * Tracks a custom event with the provided payload
 */
export declare function track(eventName: string, payload?: {
    status?: string;
    duration?: number;
    [key: string]: unknown;
}): Promise<false | import("execa").ExecaReturnValue<string> | undefined>;
export declare function identify(payload: {
    name?: string;
    email?: string;
    userId?: string;
}): Promise<import("execa").ExecaReturnValue<string> | undefined>;
//# sourceMappingURL=telemetry.d.ts.map