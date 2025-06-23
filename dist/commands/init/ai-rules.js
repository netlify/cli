import { resolve } from 'node:path';
import { promises as fs } from 'node:fs';
import { chalk, log, logAndThrowError } from '../../utils/command-helpers.js';
import { normalizeRepoUrl } from '../../utils/normalize-repo-url.js';
import { runGit } from '../../utils/run-git.js';
import { startSpinner } from '../../lib/spinner.js';
import { detectIDE } from '../../recipes/ai-context/index.js';
import { generateMcpConfig, configureMcpForVSCode, configureMcpForCursor, configureMcpForWindsurf, showGenericMcpConfig, } from '../../utils/mcp-utils.js';
import inquirer from 'inquirer';
// Trigger IDE-specific MCP configuration
const triggerMcpConfiguration = async (ide, projectPath) => {
    log(`\n${chalk.blue('🔧 MCP Configuration for')} ${chalk.cyan(ide.presentedName)}`);
    const { shouldConfigure } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'shouldConfigure',
            message: `Would you like to automatically configure the MCP server for ${ide.presentedName}?`,
            default: true,
        },
    ]);
    if (!shouldConfigure) {
        log(`   ${chalk.gray('You can configure MCP manually later for enhanced AI capabilities:')}`);
        log(`   ${chalk.gray('Documentation:')} ${chalk.cyan('https://docs.netlify.com/welcome/build-with-ai/netlify-mcp-server/')}`);
        return false;
    }
    try {
        const config = generateMcpConfig(ide);
        // IDE-specific configuration actions
        switch (ide.key) {
            case 'vscode':
                await configureMcpForVSCode(config, projectPath);
                break;
            case 'cursor':
                await configureMcpForCursor(config, projectPath);
                break;
            case 'windsurf':
                await configureMcpForWindsurf(config, projectPath);
                break;
            default:
                showGenericMcpConfig(config, ide.presentedName);
        }
        log(`${chalk.green('✅')} MCP configuration completed for ${chalk.cyan(ide.presentedName)}`);
        return true;
    }
    catch (error) {
        log(`${chalk.red('❌')} Failed to configure MCP: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
    }
};
// Helper functions reused from ai-start.ts
const decodeHash = (hash) => {
    try {
        return atob(hash);
    }
    catch (error) {
        throw new Error(`Failed to decode hash: ${error instanceof Error ? error.message : 'Invalid base64 or URL'}`);
    }
};
const fetchProjectInfo = async (url) => {
    try {
        const response = await fetch(url, {
            headers: {
                'content-type': 'text/plain',
            },
        });
        const data = (await response.text());
        const parsedData = JSON.parse(data);
        return parsedData;
    }
    catch (error) {
        throw new Error(`Failed to fetch project information: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
const getRepoUrlFromProjectId = async (api, projectId) => {
    try {
        const siteInfo = (await api.getSite({ siteId: projectId }));
        const repoUrl = siteInfo.build_settings?.repo_url;
        if (!repoUrl) {
            throw new Error(`No repository URL found for project ID: ${projectId}`);
        }
        return repoUrl;
    }
    catch (error) {
        if (error.status === 404) {
            throw new Error(`Project with ID ${projectId} not found`);
        }
        throw new Error(`Failed to fetch project data: ${error.message}`);
    }
};
const savePrompt = async (instructions, ntlContext, targetDir) => {
    try {
        const filePath = resolve(targetDir, 'AI-instructions.md');
        await fs.writeFile(filePath, `Context: ${ntlContext ?? ''}\n\n${instructions}`, 'utf-8');
        log(`${chalk.green('✅')} AI instructions saved to ${chalk.cyan('AI-instructions.md')}`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log(`${chalk.yellow('⚠️')} Warning: Failed to save AI instructions: ${errorMessage}`);
    }
};
const cloneRepo = async (repoUrl, targetDir, debug) => {
    try {
        await runGit(['clone', repoUrl, targetDir], !debug);
    }
    catch (error) {
        throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : error?.toString() ?? ''}`);
    }
};
/**
 * Handles AI rules initialization workflow
 * This is the experimental --ai-rules functionality for the init command
 */
export const initWithAiRules = async (hash, command) => {
    // Authenticate first before any API operations
    await command.authenticate();
    const { api } = command.netlify;
    log(`${chalk.blue('🤖 Initializing AI project')} with rules...`);
    log(`${chalk.gray('User:')} ${api.accessToken ? 'Authenticated ✅' : 'Not authenticated ❌'}`);
    try {
        // Step 1: Decode hash and fetch project information
        log('\n📋 Extracting project details...');
        const decodedUrl = decodeHash(hash);
        log(`${chalk.cyan('Decoded URL:')} ${decodedUrl}`);
        log('\n🔍 Fetching project information...');
        const projectInfo = await fetchProjectInfo(decodedUrl);
        log(`${chalk.cyan('Project ID:')} ${projectInfo.projectId}`);
        // Step 2: Get repository URL from project ID via Netlify site API
        log('\n🔗 Linking to Netlify project and fetching repository...');
        const repositoryUrl = await getRepoUrlFromProjectId(api, projectInfo.projectId);
        log(`${chalk.cyan('Repository:')} ${repositoryUrl}`);
        // Step 3: Clone repository
        const { repoUrl, repoName } = normalizeRepoUrl(repositoryUrl);
        const targetDir = `ai-project-${repoName}-${hash.substring(0, 8)}`;
        const cloneSpinner = startSpinner({ text: `Cloning repository to ${chalk.cyan(targetDir)}` });
        await cloneRepo(repoUrl, targetDir, false);
        cloneSpinner.success({ text: `Cloned repository to ${chalk.cyan(targetDir)}` });
        // Step 4: Save AI instructions to file
        if (projectInfo.prompt) {
            const ntlContext = await fetch('https://docs.netlify.com/ai-context/scoped-context?scopes=serverless,blobs,forms', {
                method: 'GET',
                headers: {
                    'Content-Type': 'text/plain',
                },
            })
                .then((res) => res.text())
                .catch(() => {
                return null;
            });
            log('\n📝 Saving AI instructions...');
            await savePrompt(projectInfo.prompt, ntlContext, targetDir);
        }
        // Step 5: Detect IDE and configure MCP server
        log('\n🔍 Detecting development environment...');
        const detectedIDE = await detectIDE();
        let mcpConfigured = false;
        if (detectedIDE) {
            log(`${chalk.green('✅')} Detected development environment: ${chalk.cyan(detectedIDE.presentedName)}`);
            mcpConfigured = await triggerMcpConfiguration(detectedIDE, targetDir);
        }
        // Update working directory to cloned repo
        process.chdir(targetDir);
        command.workingDir = targetDir;
        // Success message with next steps
        log();
        log(chalk.green('✔ Your AI project is ready to go!'));
        log(`→ Project ID: ${chalk.cyanBright(projectInfo.projectId)}`);
        log(`→ Project cloned to: ${chalk.cyanBright(targetDir)}`);
        if (projectInfo.prompt) {
            log(`→ AI instructions saved: ${chalk.cyanBright('AI-instructions.md')}`);
        }
        log();
        log(chalk.yellowBright(`📁 Step 1: Enter your project directory`));
        log(`   ${chalk.cyanBright(`cd ${targetDir}`)}`);
        if (detectedIDE) {
            if (mcpConfigured) {
                log(chalk.yellowBright(`🔧 Step 2: MCP Server Configured`));
                log(`   ${chalk.green('✅')} ${chalk.cyan(detectedIDE.key)} is ready with Netlify MCP server`);
                log(`   ${chalk.gray('💡 MCP will activate when you reload/restart your development environment')}`);
            }
            else {
                log(chalk.yellowBright(`🔧 Step 2: Manual MCP Configuration`));
                log(`   ${chalk.cyan(detectedIDE.key)} detected - MCP setup was skipped`);
                log(`   ${chalk.gray('You can configure MCP manually later for enhanced AI capabilities:')}`);
                log(`   ${chalk.gray('Documentation:')} ${chalk.cyan('https://docs.netlify.com/welcome/build-with-ai/netlify-mcp-server/')}`);
            }
            log();
        }
        if (projectInfo.prompt) {
            const stepNumber = detectedIDE ? '3' : '2';
            log(chalk.yellowBright(`🤖 Step ${stepNumber}: Ask your AI assistant to process the instructions`));
            log();
            log(chalk.gray('*'.repeat(60)));
            log(chalk.cyan(`Follow ${targetDir}/AI-instructions.md and create a new site`));
            log(chalk.gray('*'.repeat(60)));
            log();
        }
    }
    catch (error) {
        return logAndThrowError(error);
    }
};
//# sourceMappingURL=ai-rules.js.map