export declare const ADDON_VALIDATION: {
    EXISTS: string;
    NOT_EXISTS: string;
};
export declare const getCurrentAddon: ({ addonName, addons }: {
    addonName: any;
    addons: any;
}) => any;
export declare const getAddonManifest: ({ addonName, api }: {
    addonName: any;
    api: any;
}) => Promise<any>;
export declare const getSiteData: ({ api, siteId }: {
    api: any;
    siteId: any;
}) => Promise<any>;
export declare const getAddons: ({ api, siteId }: {
    api: any;
    siteId: any;
}) => Promise<any>;
/**
 *
 * @param {object} config
 * @param {import('../../commands/base-command.js').default} config.command
 * @param {string} [config.addonName]
 * @param {keyof ADDON_VALIDATION} [config.validation]
 */
export declare const prepareAddonCommand: ({ addonName, command, validation }: {
    addonName: any;
    command: any;
    validation: any;
}) => Promise<{
    manifest: any;
    addons: any;
    addon: any;
    siteData: any;
}>;
//# sourceMappingURL=prepare.d.ts.map