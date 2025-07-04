import { resolve } from 'node:path';
import { promises as fs } from 'node:fs';
import { chalk, log, logAndThrowError } from '../../utils/command-helpers.js';
import { normalizeRepoUrl } from '../../utils/normalize-repo-url.js';
import { runGit } from '../../utils/run-git.js';
import { startSpinner } from '../../lib/spinner.js';
import { getContextConsumers } from '../../recipes/ai-context/context.js';
import execa from '../../utils/execa.js';
import { version } from '../../utils/command-helpers.js';
import inquirer from 'inquirer';
// Check if a command belongs to a known IDE (reusing ai-context logic)
const getConsumerKeyFromCommand = (command, consumers) => {
    const match = consumers.find((consumer) => consumer.consumerProcessCmd && command.includes(consumer.consumerProcessCmd));
    return match ? match.key : null;
};
// Get command and parent PID (same logic as ai-context)
const getCommandAndParentPID = async (pid) => {
    const { stdout } = await execa('ps', ['-p', String(pid), '-o', 'ppid=,comm=']);
    const output = stdout.trim();
    const spaceIndex = output.indexOf(' ');
    const parentPID = output.substring(0, spaceIndex);
    const command = output.substring(spaceIndex + 1).toLowerCase();
    const consumers = await getContextConsumers(version); // Use current CLI version
    return {
        parentPID: Number(parentPID),
        command,
        consumerKey: getConsumerKeyFromCommand(command, consumers),
    };
};
// Detect IDE by walking up process tree (same logic as ai-context)
const detectIDE = async () => {
    if (process.env.AI_CONTEXT_SKIP_DETECTION === 'true') {
        return null;
    }
    const ppid = process.ppid;
    let result;
    try {
        result = await getCommandAndParentPID(ppid);
        while (result.parentPID !== 1 && !result.consumerKey) {
            result = await getCommandAndParentPID(result.parentPID);
        }
    }
    catch {
        // Process detection failed
        return null;
    }
    if (result.consumerKey) {
        const consumers = await getContextConsumers(version);
        const contextConsumer = consumers.find((consumer) => consumer.key === result.consumerKey);
        if (contextConsumer) {
            return contextConsumer;
        }
    }
    return null;
};
// Generate MCP configuration for the detected IDE
const generateMcpConfig = (ide) => {
    const configs = {
        vscode: JSON.stringify({
            servers: {
                netlify: {
                    type: 'stdio',
                    command: 'npx',
                    args: ['-y', '@netlify/mcp'],
                },
            },
        }, null, 2),
        cursor: JSON.stringify({
            mcpServers: {
                netlify: {
                    command: 'npx',
                    args: ['-y', '@netlify/mcp'],
                },
            },
        }, null, 2),
        windsurf: JSON.stringify({
            mcpServers: {
                netlify: {
                    command: 'npx',
                    args: ['-y', '@netlify/mcp'],
                },
            },
        }, null, 2),
    };
    return (configs[ide.key] ||
        JSON.stringify({
            mcpServers: {
                netlify: {
                    command: 'npx',
                    args: ['-y', '@netlify/mcp'],
                },
            },
        }, null, 2));
};
// Trigger IDE-specific MCP configuration
const triggerMcpConfiguration = async (ide, projectPath) => {
    log(`\n${chalk.blue('🔧 MCP Configuration for')} ${chalk.cyan(ide.presentedName)}`);
    const { shouldConfigure } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'shouldConfigure',
            message: `Would you like to automatically configure MCP server for ${ide.presentedName}?`,
            default: true,
        },
    ]);
    if (!shouldConfigure) {
        log(chalk.gray('Skipped MCP configuration. You can set it up manually later.'));
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
// VS Code specific MCP configuration
const configureMcpForVSCode = async (config, projectPath) => {
    const configPath = resolve(projectPath, '.vscode', 'mcp.json');
    try {
        // Create .vscode directory if it doesn't exist
        await fs.mkdir(resolve(projectPath, '.vscode'), { recursive: true });
        // Write or update mcp.json
        let existingConfig = {};
        try {
            const existingContent = await fs.readFile(configPath, 'utf-8');
            existingConfig = JSON.parse(existingContent);
        }
        catch {
            // File doesn't exist or is invalid JSON
        }
        const mcpConfig = JSON.parse(config);
        const updatedConfig = { ...existingConfig, ...mcpConfig };
        await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');
        log(`${chalk.green('✅')} VS Code MCP configuration saved to ${chalk.cyan('.vscode/mcp.json')}`);
    }
    catch (error) {
        throw new Error(`Failed to configure VS Code MCP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
// Cursor specific MCP configuration
const configureMcpForCursor = async (config, projectPath) => {
    const configPath = resolve(projectPath, '.cursor', 'mcp.json');
    try {
        await fs.mkdir(resolve(projectPath, '.cursor'), { recursive: true });
        await fs.writeFile(configPath, config, 'utf-8');
        log(`${chalk.green('✅')} Cursor MCP configuration saved to ${chalk.cyan('.cursor/mcp.json')}`);
    }
    catch (error) {
        throw new Error(`Failed to configure Cursor MCP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
// Windsurf specific MCP configuration
const configureMcpForWindsurf = async (config, _projectPath) => {
    const { homedir } = await import('node:os');
    const configPath = resolve(homedir(), '.codeium', 'windsurf', 'mcp_config.json');
    try {
        // Create .codeium/windsurf directory if it doesn't exist
        await fs.mkdir(resolve(homedir(), '.codeium', 'windsurf'), { recursive: true });
        // Read existing config or create new one
        let existingConfig = {};
        try {
            const existingContent = await fs.readFile(configPath, 'utf-8');
            existingConfig = JSON.parse(existingContent);
        }
        catch {
            // File doesn't exist or is invalid JSON
        }
        const mcpConfig = JSON.parse(config);
        // Merge mcpServers from both configs
        const existingServers = existingConfig.mcpServers ?? {};
        const newServers = mcpConfig.mcpServers ?? {};
        const updatedConfig = {
            ...existingConfig,
            mcpServers: {
                ...existingServers,
                ...newServers,
            },
        };
        await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');
        log(`${chalk.green('✅')} Windsurf MCP configuration saved to global config`);
        log(`${chalk.gray('💡')} Restart Windsurf to activate the MCP server`);
    }
    catch (error) {
        throw new Error(`Failed to configure Windsurf MCP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
// Generic MCP configuration display
const showGenericMcpConfig = (config, ideName) => {
    log(`\n${chalk.yellow('📋 Manual Configuration Required')}`);
    log(`Please add the following configuration to your ${ideName} settings:`);
    log(`\n${chalk.gray('--- Configuration ---')}`);
    log(config);
    log(`${chalk.gray('--- End Configuration ---')}\n`);
};
// Try to automatically activate MCP in the detected IDE
const tryActivateMcp = async (ide, projectPath) => {
    try {
        switch (ide.key) {
            case 'vscode':
                return await activateMcpInVSCode(projectPath);
            case 'cursor':
                return await activateMcpInCursor(projectPath);
            case 'windsurf':
                return await activateMcpInWindsurf(projectPath);
            default:
                return false;
        }
    }
    catch (_) {
        // Silent fail - activation is best effort
        return false;
    }
};
// Activate MCP in VS Code
const activateMcpInVSCode = async (projectPath) => {
    try {
        // Try to reload VS Code window via command palette
        // This uses VS Code's command line interface
        await execa('code', ['--command', 'workbench.action.reloadWindow'], {
            cwd: projectPath,
            timeout: 5000,
        });
        return true;
    }
    catch {
        // Try alternative: send reload command via VS Code extension API
        try {
            await execa('code', ['--command', 'developer.reloadWindow'], {
                cwd: projectPath,
                timeout: 5000,
            });
            return true;
        }
        catch {
            return false;
        }
    }
};
// Activate MCP in Cursor
const activateMcpInCursor = async (projectPath) => {
    try {
        // Cursor might support similar command line interface
        await execa('cursor', ['--command', 'workbench.action.reloadWindow'], {
            cwd: projectPath,
            timeout: 5000,
        });
        return true;
    }
    catch {
        return false;
    }
};
// Activate MCP in Windsurf
const activateMcpInWindsurf = async (projectPath) => {
    try {
        // Windsurf-specific activation (placeholder - would need actual API)
        // For now, try to signal the IDE to reload configuration
        await execa('windsurf', ['--reload-config'], {
            cwd: projectPath,
            timeout: 5000,
        });
        return true;
    }
    catch {
        return false;
    }
};
// Move helper functions to a separate utils file
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
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${String(response.status)}`);
        }
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
        const SiteInfo = (await api.getSite({ siteId: projectId }));
        const repoUrl = SiteInfo.build_settings?.repo_url;
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
const savePrompt = async (instructions, targetDir) => {
    try {
        const filePath = resolve(targetDir, 'AI-instructions.md');
        await fs.writeFile(filePath, instructions, 'utf-8');
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
export const aiStartCommand = async (options, command) => {
    const hash = command.args[0];
    // Validate hash parameter
    if (!hash) {
        log(`${chalk.red('Error:')} Hash parameter is required`);
        log(`${chalk.gray('Usage:')} netlify ai:start <hash>`);
        return;
    }
    // Authenticate first before any API operations
    await command.authenticate();
    const { api } = command.netlify;
    log(`${chalk.blue('🤖 AI Start')} - Initializing AI project...`);
    log(`${chalk.gray('Hash:')} ${hash}`);
    log(`${chalk.gray('User:')} ${api.accessToken ? 'Authenticated ✅' : 'Not authenticated ❌'}`);
    try {
        // Step 1: Decode hash and fetch project information
        log('\n📋 Decoding project hash...');
        const decodedUrl = decodeHash(hash);
        log(`${chalk.cyan('Decoded URL:')} ${decodedUrl}`);
        log('\n🔍 Fetching project information...');
        const projectInfo = await fetchProjectInfo(decodedUrl);
        log(`${chalk.cyan('Project ID:')} ${projectInfo.projectId}`);
        // Step 2: Get repository URL from project ID via Netlify site API
        log('\n🔗 Linking to Netlify site and fetching repository...');
        const repositoryUrl = await getRepoUrlFromProjectId(api, projectInfo.projectId);
        log(`${chalk.cyan('Repository:')} ${repositoryUrl}`);
        // Step 3: Clone repository
        const { repoUrl, repoName } = normalizeRepoUrl(repositoryUrl);
        const targetDir = `ai-project-${repoName}-${hash.substring(0, 8)}`;
        const cloneSpinner = startSpinner({ text: `Cloning repository to ${chalk.cyan(targetDir)}` });
        await cloneRepo(repoUrl, targetDir, Boolean(options.debug));
        cloneSpinner.success({ text: `Cloned repository to ${chalk.cyan(targetDir)}` });
        // Step 4: Save AI instructions to file
        if (projectInfo.prompt) {
            log('\n📝 Saving AI instructions...');
            await savePrompt(projectInfo.prompt, targetDir);
        }
        // Step 5: Detect IDE and configure MCP server
        log('\n🔍 Detecting development environment...');
        const detectedIDE = await detectIDE();
        let mcpConfigured = false;
        if (detectedIDE) {
            log(`${chalk.green('✅')} Detected IDE: ${chalk.cyan(detectedIDE.presentedName)}`);
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
                log(`   ${chalk.green('✅')} ${chalk.cyan(detectedIDE.presentedName)} is ready with Netlify MCP server`);
                // Try to automatically activate MCP in the IDE
                const activated = await tryActivateMcp(detectedIDE, targetDir);
                if (activated) {
                    log(`   ${chalk.green('🚀')} MCP server automatically activated`);
                }
                else {
                    log(`   ${chalk.gray('💡 MCP will activate when you reload/restart your IDE window')}`);
                }
            }
            else {
                log(chalk.yellowBright(`🔧 Step 2: Manual MCP Configuration`));
                log(`   ${chalk.cyan(detectedIDE.presentedName)} detected - MCP setup was skipped`);
                log(`   ${chalk.gray('You can configure MCP manually later for enhanced AI capabilities')}`);
            }
            log();
        }
        if (projectInfo.prompt) {
            const stepNumber = detectedIDE ? '3' : '2';
            log(chalk.yellowBright(`🤖 Step ${stepNumber}: Ask your AI assistant to process the instructions`));
            log();
            log(chalk.bgGreen.black.bold(`  follow instructions in ${targetDir}/AI-instructions.md  `));
            log();
        }
    }
    catch (error) {
        return logAndThrowError(error);
    }
};
//# sourceMappingURL=ai-start.js.map