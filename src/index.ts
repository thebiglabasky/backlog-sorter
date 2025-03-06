import { LinearClient } from '@linear/sdk';
import chalk from 'chalk';
import {
  clearCache,
  clearIssuesCache,
  clearScoringCache,
  getCacheMetadata,
  getScoringCacheMetadata,
  loadCachedScoredIssues
} from './cache-manager.js';
import { displayEnvHelp, displayHelp, parseArgs } from './cli.js';
import { getApiKey, loadConfig, PrioritizerConfig } from './config.js';
import { compareScoring } from './diff.js';
import { IssueFetcher } from './issue-fetcher.js';
import { LinearUpdater } from './linear-updater.js';
import { displayDetailedResults, displayRankingChanges, displaySortedIssuesWithChanges, displayStatistics } from './presentation.js';
import { IssueScorer } from './scoring/index.js';
import { IssueScore } from './types.js';

/**
 * Main function to run the backlog prioritizer
 */
async function main() {
  console.log(chalk.bold.blue('Linear Backlog Prioritizer'));
  console.log(chalk.gray('==============================\n'));

  // Parse command line arguments
  const args = parseArgs();

  // Show help message
  if (args.showHelp) {
    displayHelp();
    process.exit(0);
  }

  // Show environment variable help
  if (args.showEnvHelp) {
    displayEnvHelp();
    process.exit(0);
  }

  // Handle cache management commands
  if (args.clearCacheFlag) {
    await clearCache();
    if (!args.forceRefresh) {
      process.exit(0);
    }
  }

  if (args.clearScoringCacheFlag) {
    await clearScoringCache();
    if (!args.forceRefresh) {
      process.exit(0);
    }
  }

  if (args.clearIssuesCacheFlag) {
    await clearIssuesCache();
    if (!args.forceRefresh) {
      process.exit(0);
    }
  }

  // Handle refresh-issues-only command
  if (args.refreshIssuesOnly) {
    try {
      // Clear the issues cache first
      await clearIssuesCache();
      console.log(chalk.blue('Issues cache cleared.'));

      // Load configuration
      const config = loadConfig();
      const apiKey = getApiKey();
      const client = new LinearClient({ apiKey });

      // Create the issue fetcher with force refresh
      const issueFetcher = new IssueFetcher(
        client,
        config,
        true, // Use cache for saving
        true  // Force refresh from API
      );

      // Fetch issues
      console.log(chalk.blue('Fetching issues from Linear API...'));
      const issues = await issueFetcher.fetchIssues();

      console.log(chalk.green(`Successfully fetched and cached ${issues.length} issues.`));
      console.log(chalk.gray('Issues have been cached but not scored.'));
      console.log(chalk.gray('To score these issues, run with --score-only.'));
    } catch (error) {
      console.error(chalk.red('Error refreshing issues:'));
      if (error instanceof Error) {
        console.error(chalk.red(`  - ${error.message}`));
      } else {
        console.error(chalk.red(`  - ${String(error)}`));
      }
      process.exit(1);
    }
    process.exit(0);
  }

  if (args.showCacheInfo) {
    const metadata = await getCacheMetadata();
    if (metadata) {
      console.log(chalk.yellow("\nCache Information:"));
      console.log(chalk.gray(`  - Last Updated: ${new Date(metadata.lastUpdated).toLocaleString()}`));
      console.log(chalk.gray(`  - Team ID: ${metadata.teamId}`));
      console.log(chalk.gray(`  - Backlog State ID: ${metadata.backlogStateId}`));
      console.log(chalk.gray(`  - Issue Count: ${metadata.issueCount}`));

      // Calculate cache age
      const lastUpdated = new Date(metadata.lastUpdated);
      const now = new Date();
      const cacheAgeHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
      console.log(chalk.gray(`  - Cache Age: ${cacheAgeHours.toFixed(1)} hours`));

      // Show configured TTL
      const configuredTtl = parseInt(process.env.LINEAR_CACHE_TTL_HOURS || '24', 10);
      console.log(chalk.gray(`  - Cache TTL: ${configuredTtl} hours`));
      console.log(chalk.gray(`  - Cache Status: ${cacheAgeHours < configuredTtl ? chalk.green('Valid') : chalk.red('Expired')}`));
    } else {
      console.log(chalk.yellow("\nNo cache information available."));
    }

    if (!args.forceRefresh) {
      process.exit(0);
    }
  }

  if (args.showScoringCacheInfo) {
    const metadata = await getScoringCacheMetadata();
    if (metadata) {
      console.log(chalk.yellow("\nScoring Cache Information:"));
      console.log(chalk.gray(`  - Last Updated: ${new Date(metadata.lastUpdated).toLocaleString()}`));
      console.log(chalk.gray(`  - Team ID: ${metadata.teamId}`));
      console.log(chalk.gray(`  - Backlog State ID: ${metadata.backlogStateId}`));
      console.log(chalk.gray(`  - Issue Count: ${metadata.issueCount}`));
      console.log(chalk.gray(`  - Relevance Keywords: ${metadata.relevanceKeywords.join(', ')}`));

      // Calculate cache age
      const lastUpdated = new Date(metadata.lastUpdated);
      const now = new Date();
      const cacheAgeHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
      console.log(chalk.gray(`  - Cache Age: ${cacheAgeHours.toFixed(1)} hours`));

      // Show configured TTL
      const configuredTtl = parseInt(process.env.LINEAR_CACHE_TTL_HOURS || '24', 10);
      console.log(chalk.gray(`  - Cache TTL: ${configuredTtl} hours`));
      console.log(chalk.gray(`  - Cache Status: ${cacheAgeHours < configuredTtl ? chalk.green('Valid') : chalk.red('Expired')}`));
    } else {
      console.log(chalk.yellow("\nNo scoring cache information available."));
    }

    if (!args.forceRefresh) {
      process.exit(0);
    }
  }

  // Get API key and configuration
  const apiKey = getApiKey();
  const config = loadConfig();

  // Create Linear client
  const client = new LinearClient({ apiKey });

  try {
    // Load previous scoring results if we're doing a score-only run with no scoring cache
    // This allows us to compare the changes between runs
    let previousScoredIssues: any[] | null = null;
    if (args.scoreOnly && args.noScoringCache) {
      previousScoredIssues = await loadCachedScoredIssues(true);
      if (previousScoredIssues) {
        console.log(chalk.blue(`Loaded previous scoring results (${previousScoredIssues.length} issues) for comparison.`));
      }
    }

    // Handle show-scores command (just display cached scores without recomputing)
    if (args.showScores) {
      const cachedScoredIssues = await loadCachedScoredIssues();
      if (cachedScoredIssues && cachedScoredIssues.length > 0) {
        console.log(chalk.green(`\nLoaded ${cachedScoredIssues.length} scored issues from cache.`));

        // Display the sorted issues
        console.log(chalk.yellow('\nSorted Issues:'));
        cachedScoredIssues.forEach((item, index) => {
          console.log(`${index + 1}. [${item.issue.identifier}] ${item.issue.title.substring(0, 50)}${item.issue.title.length > 50 ? '...' : ''} - Score: ${item.finalScore.toFixed(1)}`);
        });

        console.log(chalk.gray('\nTo update these in Linear, run with the --update flag.'));
        process.exit(0);
      } else {
        console.log(chalk.red('\nNo scored issues found in cache.'));
        console.log(chalk.gray('Run with --score-only to compute scores first.'));
        process.exit(1);
      }
    }

    // Create the issue fetcher
    const issueFetcher = new IssueFetcher(
      client,
      config,
      !args.noCache,
      args.forceRefresh
    );

    // Fetch issues
    const issues = await issueFetcher.fetchIssues();

    if (issues.length === 0) {
      console.log(chalk.yellow('No issues to prioritize.'));
      return;
    }

    // Create the issue scorer
    const issueScorer = new IssueScorer(
      config,
      !args.noCache && !args.noScoringCache,
      args.forceRefresh
    );

    // Score issues
    const sortedIssues = await issueScorer.scoreIssues(issues);

    // Compare with previous scoring if available
    if (previousScoredIssues && args.scoreOnly && args.noScoringCache) {
      const changes = compareScoring(previousScoredIssues, sortedIssues);
      displayRankingChanges(changes);
      displaySortedIssuesWithChanges(sortedIssues, changes);
    } else {
      // Always show all sorted issues (original behavior)
      console.log(chalk.yellow("\nSorted Issues:"));
      sortedIssues.forEach((item: IssueScore, index: number) => {
        console.log(`${chalk.cyan(`${index + 1}.`)} [${chalk.bold(item.issue.identifier)}] ${item.issue.title} - Score: ${chalk.green(item.finalScore.toFixed(1))}`);
      });
    }

    // Show more detailed results
    if (args.showDebug) {
      displayDetailedResults(sortedIssues);
    }

    // Show statistics if requested
    if (args.showStats) {
      displayStatistics(sortedIssues);
    }

    // Update the order in Linear if requested
    if (args.shouldUpdateOrder && !args.scoreOnly) {
      console.log(chalk.yellow("\nUpdating issue order in Linear..."));
      const linearUpdater = new LinearUpdater(client);
      await linearUpdater.updateIssueOrder(sortedIssues);
      console.log(chalk.green("Successfully updated issue order in Linear!"));
    } else if (args.scoreOnly) {
      console.log(chalk.yellow("\nIssues scored but not updated in Linear (--score-only flag used)."));
      console.log(chalk.gray("To apply these changes, run again with the --update flag."));
    } else {
      console.log(chalk.yellow("\nIssues scored but not updated in Linear."));
      console.log(chalk.gray("To apply these changes, run again with the --update flag."));
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

// Run the main function
// In ESM, there's no direct equivalent to require.main === module
// We can use a command line argument or environment variable instead
if (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js')) {
  main().catch(console.error);
}

// Export for use as a module
export { IssueScore, PrioritizerConfig };
