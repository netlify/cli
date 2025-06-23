import type BaseCommand from '../../commands/base-command.js';
import type { RepoData } from '../get-repo-data.js';
export default function configManual({ command, repoData, siteId, }: {
    command: BaseCommand;
    repoData: RepoData;
    siteId: string;
}): Promise<void>;
//# sourceMappingURL=config-manual.d.ts.map