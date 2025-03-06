import chalk from 'chalk';

export interface CommandLineArgs {
  // Main commands
  score: boolean;
  compare: boolean;
  updateLinear: boolean;
  reset: boolean;
  cacheDetails: boolean;
  scoreDetails: boolean;
  showHelp: boolean;
  showEnvHelp: boolean;
  noCache: boolean;
}

/**
 * Parse command line arguments
 */
export function parseArgs(): CommandLineArgs {
  const args = process.argv.slice(2);

  return {
    // Main commands
    score: args.includes("score"),
    compare: args.includes("compare"),
    updateLinear: args.includes("update-linear"),
    reset: args.includes("reset"),
    cacheDetails: args.includes("cache-details"),
    scoreDetails: args.includes("score-details"),
    noCache: args.includes("--no-cache"),
    showHelp: args.includes("--help"),
    showEnvHelp: args.includes("--env-help"),
  };
}

/**
 * Display help message
 */
export function displayHelp(): void {
  console.log(chalk.yellow("\nCommands:"));
  console.log(chalk.gray("  score           Fetch issues if needed, compute scores, and display results"));
  console.log(chalk.gray("  compare         Compare new scores with previous scoring results"));
  console.log(chalk.gray("  update-linear   Update issue order in Linear based on scoring"));
  console.log(chalk.gray("  reset           Clear all caches"));
  console.log(chalk.gray("  cache-details   Show detailed information about caches"));
  console.log(chalk.gray("  score-details   Show detailed information about scores"));
  console.log(chalk.gray("  help            Show this help message"));

  console.log(chalk.yellow("\nExamples:"));
  console.log(chalk.gray("  # Score issues"));
  console.log(chalk.gray("  npx linear-backlog-prioritizer score"));
  console.log(chalk.gray("  # Compare new scores with previous scores"));
  console.log(chalk.gray("  npx linear-backlog-prioritizer compare"));
  console.log(chalk.gray("  # Update issue order in Linear"));
  console.log(chalk.gray("  npx linear-backlog-prioritizer update-linear"));

  console.log(chalk.yellow("\nLegacy Options (Deprecated):"));
  console.log(chalk.gray("  Use the new commands above instead of these legacy options."));
  console.log(chalk.gray("  These will be removed in a future version."));
}

/**
 * Display environment variable help
 */
export function displayEnvHelp(): void {
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
  console.log(chalk.gray("    LINEAR_RELEVANCE_KEYWORDS=important,critical,urgent"));
  console.log(chalk.gray("    LINEAR_CACHE_TTL_HOURS=12"));
}
