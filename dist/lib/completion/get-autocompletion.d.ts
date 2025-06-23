import type { CompletionItem } from '@pnpm/tabtab';
declare const getAutocompletion: (env: {
    complete: boolean;
    lastPartial: string;
    line: string;
    words: number;
}, program: Record<string, CompletionItem & {
    description?: string | undefined;
    name?: string | undefined;
    options: CompletionItem[];
}>) => CompletionItem[] | undefined;
export default getAutocompletion;
//# sourceMappingURL=get-autocompletion.d.ts.map