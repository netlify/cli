export default class CLIState {
    private path;
    constructor(cwd: string);
    get all(): any;
    set all(val: any);
    get size(): number;
    get(key: any): string | undefined;
    set(...args: any[]): void;
    has(key: any): boolean;
    delete(key: any): void;
    clear(): void;
}
//# sourceMappingURL=cli-state.d.ts.map