import dotenv from 'dotenv';
export declare const loadDotEnvFiles: ({ envFiles, projectDir }: {
    envFiles: any;
    projectDir: any;
}) => Promise<({
    warning: string;
    file?: undefined;
    env?: undefined;
} | {
    file: string;
    env: dotenv.DotenvParseOutput;
    warning?: undefined;
} | undefined)[]>;
export declare const tryLoadDotEnvFiles: ({ dotenvFiles, projectDir }: {
    dotenvFiles?: string[] | undefined;
    projectDir: any;
}) => Promise<({
    warning: string;
    file?: undefined;
    env?: undefined;
} | {
    file: string;
    env: dotenv.DotenvParseOutput;
    warning?: undefined;
} | undefined)[]>;
//# sourceMappingURL=dot-env.d.ts.map