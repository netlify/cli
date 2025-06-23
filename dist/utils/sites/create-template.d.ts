import { OptionValues } from 'commander';
import { Template } from '../types.js';
export declare const fetchTemplates: (token: string) => Promise<Template[]>;
export declare const getTemplateName: ({ ghToken, options, repository, }: {
    ghToken: string;
    options: OptionValues;
    repository: string;
}) => Promise<any>;
export declare const deployedSiteExists: (name: string) => Promise<boolean>;
export declare const getGitHubLink: ({ options, templateName }: {
    options: OptionValues;
    templateName: string;
}) => string;
//# sourceMappingURL=create-template.d.ts.map