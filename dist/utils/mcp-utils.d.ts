import type { ConsumerConfig } from '../recipes/ai-context/context.js';
/**
 * Generate MCP configuration for the detected IDE or development environment
 */
export declare const generateMcpConfig: (ide: ConsumerConfig) => Record<string, unknown>;
/**
 * VS Code specific MCP configuration
 */
export declare const configureMcpForVSCode: (config: Record<string, unknown>, projectPath: string) => Promise<void>;
/**
 * Cursor specific MCP configuration
 */
export declare const configureMcpForCursor: (config: Record<string, unknown>, projectPath: string) => Promise<void>;
/**
 * Windsurf specific MCP configuration
 */
export declare const configureMcpForWindsurf: (config: Record<string, unknown>, _projectPath: string) => Promise<void>;
/**
 * Generic MCP configuration display
 */
export declare const showGenericMcpConfig: (config: Record<string, unknown>, ideName: string) => void;
//# sourceMappingURL=mcp-utils.d.ts.map