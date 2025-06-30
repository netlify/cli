import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import normalizePackageData from 'normalize-package-data';
let packageJson;
const getPackageJson = async () => {
    if (!packageJson) {
        const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '../../package.json');
        const packageData = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
        try {
            normalizePackageData(packageData);
            packageJson = packageData;
            return packageJson;
        }
        catch (error) {
            throw new Error('Could not find package.json', { cause: error });
        }
    }
    return packageJson;
};
export default getPackageJson;
//# sourceMappingURL=get-cli-package-json.js.map