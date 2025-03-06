import chalk from 'chalk';
/**
 * Parse command line arguments
 */
export function parseArgs() {
    const args = process.argv.slice(2);
    return {
        shouldUpdateOrder: args.includes("--update"),
        scoreOnly: args.includes("--score-only"),
        showScores: args.includes("--show-scores"),
        showStats: args.includes("--stats"),
        noCache: args.includes("--no-cache"),
        noScoringCache: args.includes("--no-scoring-cache"),
        forceRefresh: args.includes("--refresh"),
        clearCacheFlag: args.includes("--clear-cache"),
        clearScoringCacheFlag: args.includes("--clear-scoring-cache"),
        clearIssuesCacheFlag: args.includes("--clear-issues-cache"),
        showDebug: args.includes("--debug"),
        showCacheInfo: args.includes("--cache-info"),
        showScoringCacheInfo: args.includes("--scoring-cache-info"),
        showHelp: args.includes("--help") || args.includes("-h"),
        showEnvHelp: args.includes("--env-help"),
        refreshIssuesOnly: args.includes("--refresh-issues-only"),
        compareScores: args.includes("--compare-scores")
    };
}
/**
 * Display help message
 */
export function displayHelp() {
    console.log(chalk.yellow("\nUsage Options:"));
    console.log(chalk.gray("  --update               Update issue order in Linear based on scoring"));
    console.log(chalk.gray("  --score-only           Only score issues, don't update in Linear"));
    console.log(chalk.gray("  --show-scores          Show cached scores without recomputing"));
    console.log(chalk.gray("  --stats                Show detailed statistics about scoring"));
    console.log(chalk.gray("  --no-cache             Don't use or update the issues cache"));
    console.log(chalk.gray("  --no-scoring-cache     Don't use or update the scoring cache"));
    console.log(chalk.gray("  --refresh              Force refresh from API even if cache is valid"));
    console.log(chalk.gray("  --clear-cache          Clear all caches"));
    console.log(chalk.gray("  --clear-scoring-cache  Clear only the scoring cache"));
    console.log(chalk.gray("  --clear-issues-cache   Clear only the issues cache"));
    console.log(chalk.gray("  --refresh-issues-only  Refresh issues from API without scoring"));
    console.log(chalk.gray("  --compare-scores       Refresh issues but keep scoring cache for comparison"));
    console.log(chalk.gray("  --debug                Show detailed scoring breakdown"));
    console.log(chalk.gray("  --cache-info           Show information about the issues cache"));
    console.log(chalk.gray("  --scoring-cache-info   Show information about the scoring cache"));
    console.log(chalk.gray("  --help, -h             Show this help message"));
    console.log(chalk.gray("  --env-help             Show environment variable documentation"));
    console.log(chalk.yellow("\nExamples:"));
    console.log(chalk.gray("  # Score issues and update in Linear"));
    console.log(chalk.gray("  npx linear-backlog-prioritizer --update"));
    console.log(chalk.gray("  # Score issues without updating Linear"));
    console.log(chalk.gray("  npx linear-backlog-prioritizer --score-only"));
    console.log(chalk.gray("  # Refresh issues and compare with previous scores"));
    console.log(chalk.gray("  npx linear-backlog-prioritizer --compare-scores"));
}
/**
 * Display environment variable help
 */
export function displayEnvHelp() {
    console.log(chalk.yellow("\nEnvironment Variables Configuration:"));
    console.log(chalk.gray("  Required:"));
    console.log(chalk.gray("    LINEAR_API_KEY           Your Linear API key"));
    console.log(chalk.gray("    LINEAR_TEAM_ID           ID of the team whose backlog you want to prioritize"));
    console.log(chalk.gray("    LINEAR_BACKLOG_STATE_ID  ID of the state that represents your backlog"));
    console.log(chalk.gray("\n  Optional:"));
    console.log(chalk.gray("    LINEAR_TARGET_INITIATIVE Name of the initiative to prioritize (if any)"));
    console.log(chalk.gray("    LINEAR_TARGET_PROJECT    Name of the project to prioritize (if any)"));
    console.log(chalk.gray("    LINEAR_RELEVANCE_KEYWORDS Comma-separated list of keywords for relevance scoring"));
    console.log(chalk.gray("    LINEAR_CACHE_TTL_HOURS   How long to consider cache valid (default: 24)"));
    console.log(chalk.gray("\n  Example .env file:"));
    console.log(chalk.gray("    LINEAR_API_KEY=lin_api_xxxxxxxxxxxx"));
    console.log(chalk.gray("    LINEAR_TEAM_ID=team_xxxxxxxx"));
    console.log(chalk.gray("    LINEAR_BACKLOG_STATE_ID=state_xxxxxxxx"));
    console.log(chalk.gray("    LINEAR_TARGET_INITIATIVE=Q3 Goals"));
    console.log(chalk.gray("    LINEAR_TARGET_PROJECT=Performance Improvements"));
    console.log(chalk.gray("    LINEAR_RELEVANCE_KEYWORDS=performance,speed,optimization,latency"));
    console.log(chalk.gray("    LINEAR_CACHE_TTL_HOURS=48"));
    console.log(chalk.gray("\nTo find IDs, run the find-ids.ts script:"));
    console.log(chalk.gray("  npm run find-ids"));
}
