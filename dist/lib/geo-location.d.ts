export type Geolocation = {
    city: string;
    country: {
        code: string;
        name: string;
    };
    subdivision: {
        code: string;
        name: string;
    };
    longitude: number;
    latitude: number;
    timezone: string;
};
interface State {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
}
export declare const mockLocation: Geolocation;
/**
 * Returns geolocation data from a remote API, the local cache, or a mock location, depending on the
 * specified mode.
 */
export declare const getGeoLocation: ({ geoCountry, mode, offline, state, }: {
    mode: "cache" | "update" | "mock";
    geoCountry?: string | undefined;
    offline?: boolean | undefined;
    state: State;
}) => Promise<Geolocation>;
export {};
//# sourceMappingURL=geo-location.d.ts.map