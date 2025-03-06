export interface PrioritizerConfig {
    teamId: string;
    backlogStateId: string;
    targetInitiative?: string;
    targetProject?: string;
    relevanceKeywords: string[];
    cacheTtlHours: number;
}
export interface PrioritizerOptions {
    useCache: boolean;
    forceRefresh: boolean;
    useScoringCache: boolean;
}
export declare const EMPLOYEE_ALIASES: string[];
/**
 * Load configuration from environment variables
 */
export declare function loadConfig(): PrioritizerConfig;
/**
 * Get API key from environment variables
 */
export declare function getApiKey(): string;
