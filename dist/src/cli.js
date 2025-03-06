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
        showEnvHelp: args.includes("--env-help")
    };
}
/**
 * Display help message
 */
export function displayHelp() {
    console.log(chalk.yellow("Usage:"));
    console.log(chalk.gray("  node dist/main.js [options]"));
    console.log(chalk.yellow("\nOptions:"));
    console.log(chalk.gray("  --update              Update the order of issues in Linear"));
    console.log(chalk.gray("  --score-only          Recompute scores using the issues cache but don't update Linear"));
    console.log(chalk.gray("  --show-scores         Show the scored issues from the cache without recomputing"));
    console.log(chalk.gray("  --stats               Show detailed statistics about the scoring"));
    console.log(chalk.gray("  --no-cache            Disable all caching (both issues and scoring)"));
    console.log(chalk.gray("  --no-scoring-cache    Disable scoring cache but use issues cache"));
    console.log(chalk.gray("  --refresh             Force refresh from API"));
    console.log(chalk.gray("  --clear-cache         Clear all caches"));
    console.log(chalk.gray("  --clear-scoring-cache Clear only the scoring cache"));
    console.log(chalk.gray("  --clear-issues-cache  Clear only the issues cache"));
    console.log(chalk.gray("  --cache-info          Show information about the issues cache"));
    console.log(chalk.gray("  --scoring-cache-info  Show information about the scoring cache"));
    console.log(chalk.gray("  --debug               Show debug information"));
    console.log(chalk.gray("  --env-help            Show environment variable configuration help"));
    console.log(chalk.gray("  --help, -h            Show this help message"));
    console.log(chalk.yellow("\nCache Strategy:"));
    console.log(chalk.gray("  1. First checks for a valid scoring cache"));
    console.log(chalk.gray("  2. If no scoring cache, checks for a valid issues cache"));
    console.log(chalk.gray("  3. If no issues cache, fetches from Linear API"));
    console.log(chalk.yellow("\nComparing Scoring Changes:"));
    console.log(chalk.gray("  Use --score-only --no-scoring-cache to compare new scores with previous scoring results"));
    console.log(chalk.gray("  This will show which issues moved up or down in priority based on your Linear changes"));
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
