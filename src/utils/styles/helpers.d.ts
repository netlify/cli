import { State } from '@clack/core';
export declare const coloredSymbol: (state: State) => string;
interface LimitOptionsParams<TOption> {
    options: TOption[];
    maxItems: number | undefined;
    cursor: number;
    style: (option: TOption, active: boolean) => string;
}
export declare const limitOptions: <TOption>(params: LimitOptionsParams<TOption>) => string[];
export declare const ansiRegex: () => RegExp;
export declare const jsonOnly: () => boolean;
export {};
//# sourceMappingURL=helpers.d.ts.map