type ConfigStoreOptions<T extends Record<string, any>> = {
    defaults?: T | undefined;
};
export declare class GlobalConfigStore<T extends Record<string, any> = Record<string, any>> {
    #private;
    constructor(options?: ConfigStoreOptions<T>);
    get all(): T;
    set(key: string, value: unknown): void;
    get(key: string): T[typeof key];
    private getConfig;
    private writeConfig;
}
declare const getGlobalConfigStore: () => Promise<GlobalConfigStore>;
export default getGlobalConfigStore;
export declare const resetConfigCache: () => void;
//# sourceMappingURL=get-global-config-store.d.ts.map