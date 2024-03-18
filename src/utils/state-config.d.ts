export default class StateConfig {
    constructor(cwd: any);
    get all(): any;
    set all(val: any);
    get size(): number;
    get(key: any): string | undefined;
    set(...args: any[]): void;
    has(key: any): boolean;
    delete(key: any): void;
    clear(): void;
}
//# sourceMappingURL=state-config.d.ts.map