export interface CommandLineArgs {
    shouldUpdateOrder: boolean;
    scoreOnly: boolean;
    showScores: boolean;
    showStats: boolean;
    noCache: boolean;
    noScoringCache: boolean;
    forceRefresh: boolean;
    clearCacheFlag: boolean;
    clearScoringCacheFlag: boolean;
    clearIssuesCacheFlag: boolean;
    showDebug: boolean;
    showCacheInfo: boolean;
    showScoringCacheInfo: boolean;
    showHelp: boolean;
    showEnvHelp: boolean;
    refreshIssuesOnly: boolean;
    compareScores: boolean;
}
/**
 * Parse command line arguments
 */
export declare function parseArgs(): CommandLineArgs;
/**
 * Display help message
 */
export declare function displayHelp(): void;
/**
 * Display environment variable help
 */
export declare function displayEnvHelp(): void;
