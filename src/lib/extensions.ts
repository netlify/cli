import { Project } from "@netlify/build-info";

export const packagesThatNeedSites = ['@netlify/neon']

export async function handleExtensionRequirements(project: Project) {
    // Go through all the packages that need sites, see if they exist in the package.json
    // and if they do then we have to do a site init or whatever
    const packageJson = await project.getPackageJSON()
    const dependencies = packageJson.dependencies ?? {}
    
    packagesThatNeedSites.forEach(packageName => {
        if (dependencies[packageName]) {
            console.log('wow found it neato')
        }
    })

}