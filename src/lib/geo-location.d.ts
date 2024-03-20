/**
 * @typedef GeoLocation
 * @type {object}
 * @property {string} city
 * @property {object} country
 * @property {string} country.code
 * @property {string} country.name
 * @property {object} subdivision
 * @property {string} subdivision.code
 * @property {string} subdivision.name
 * @property {number} longitude
 * @property {number} latitude
 * @property {string} timezone
 */
export declare const mockLocation: {
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
/**
 * Returns geolocation data from a remote API, the local cache, or a mock
 * location, depending on the mode selected.
 *
 * @param {object} params
 * @param {"cache"|"update"|"mock"} params.mode
 * @param {string} params.geoCountry
 * @param {boolean} params.offline
 * @param {import('../utils/state-config.js').default} params.state
 * @returns {Promise<GeoLocation>}
 */
export declare const getGeoLocation: ({ geoCountry, mode, offline, state }: {
    geoCountry: any;
    mode: any;
    offline: any;
    state: any;
}) => Promise<any>;
//# sourceMappingURL=geo-location.d.ts.map