/// <reference types="node" resolution-mode="require"/>
export interface TextOptions {
    message: string;
    placeholder?: string;
    defaultValue?: string;
    initialValue?: string;
    validate?: (value: string) => string | void;
}
export declare const text: (opts: TextOptions) => Promise<string>;
export interface PasswordOptions {
    message: string;
    mask?: string;
    validate?: (value: string) => string | void;
}
export declare const password: (opts: PasswordOptions) => Promise<string>;
export interface ConfirmOptions {
    message: string;
    active?: string;
    inactive?: string;
    initialValue?: boolean;
}
export declare const confirm: (opts: ConfirmOptions) => Promise<boolean>;
type Primitive = Readonly<string | boolean | number>;
type Option<Value> = Value extends Primitive ? {
    value: Value;
    label?: string;
    hint?: string;
    group?: string | true;
} : {
    value: Value;
    label: string;
    hint?: string;
    group?: string | true;
};
export interface SelectOptions<Value> {
    message: string;
    options: Option<Value>[];
    initialValue?: Value;
    maxItems?: number;
}
export declare const select: <Value>(opts: SelectOptions<Value>) => Promise<Value>;
export declare const selectKey: <Value extends string>(opts: SelectOptions<Value>) => Promise<symbol | Value>;
export interface MultiSelectOptions<Value> {
    message: string;
    options: Option<Value>[];
    initialValues?: Value[];
    maxItems?: number;
    required?: boolean;
    cursorAt?: Value;
}
export declare const multiselect: <Value>(opts: MultiSelectOptions<Value>) => Promise<symbol | Value[]>;
export interface GroupMultiSelectOptions<Value> {
    message: string;
    options: Record<string, Option<Value>[]>;
    initialValues?: Value[];
    required?: boolean;
    cursorAt?: Value;
}
export declare const groupMultiselect: <Value>(opts: GroupMultiSelectOptions<Value>) => Promise<symbol | Value[]>;
export declare const note: (message?: string, title?: string) => void;
export declare const cancel: (message?: string) => void;
export declare const intro: (title?: string) => void;
type OutroOptions = {
    message?: string;
    exit?: boolean;
    code?: number;
};
export declare const outro: ({ code, exit, message }: OutroOptions) => void;
export type LogMessageOptions = {
    symbol?: string;
    error?: boolean;
    writeStream?: NodeJS.WriteStream;
    noSpacing?: boolean;
};
export declare const NetlifyLog: {
    message: (message?: string, { error, noSpacing, symbol, writeStream, }?: LogMessageOptions) => void;
    info: (message: string) => void;
    success: (message: string) => void;
    step: (message: string) => void;
    warn: (message: string) => void;
    /** alias for `log.warn()`. */
    warning: (message: string) => void;
    error: (message?: Error | string | unknown, options?: {
        exit?: boolean;
    }) => void;
};
export declare const spinner: () => {
    start: (msg?: string) => void;
    stop: (msg?: string, code?: number) => void;
    message: (msg?: string) => void;
};
export type PromptGroupAwaitedReturn<T> = {
    [P in keyof T]: Exclude<Awaited<T[P]>, symbol>;
};
export interface PromptGroupOptions<T> {
    /**
     * Control how the group can be canceled
     * if one of the prompts is canceled.
     */
    onCancel?: (opts: {
        results: Prettify<Partial<PromptGroupAwaitedReturn<T>>>;
    }) => void;
}
type Prettify<T> = {
    [P in keyof T]: T[P];
} & Record<string, never>;
export type PromptGroup<T> = {
    [P in keyof T]: (opts: {
        results: Prettify<Partial<PromptGroupAwaitedReturn<Omit<T, P>>>>;
    }) => void | Promise<T[P] | void>;
};
/**
 * Define a group of prompts to be displayed
 * and return a results of objects within the group
 */
export declare const group: <T>(prompts: PromptGroup<T>, opts?: PromptGroupOptions<T> | undefined) => Promise<Prettify<PromptGroupAwaitedReturn<T>>>;
export type Task = {
    /**
     * Task title
     */
    title: string;
    /**
     * Task function
     */
    task: (message: (string: string) => void) => string | Promise<string> | void | Promise<void>;
    /**
     * If enabled === false the task will be skipped
     */
    enabled?: boolean;
};
/**
 * Define a group of tasks to be executed
 */
export declare const tasks: (tasksToComplete: Task[]) => Promise<void>;
export {};
//# sourceMappingURL=index.d.ts.map