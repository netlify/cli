export default function generatePrompts(settings: any): (false | {
    type: string;
    name: string;
    message: string;
    validate?: undefined;
} | {
    type: string;
    name: string;
    message: string;
    validate: ((value: any) => string | true) | (() => boolean);
} | undefined)[];
//# sourceMappingURL=prompts.d.ts.map