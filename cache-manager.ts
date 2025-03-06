import { IssueConnection } from '@linear/sdk';
import chalk from 'chalk';
import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';

// Define the cache directory
const CACHE_DIR = path.join(process.cwd(), '.cache');
const ISSUES_CACHE_FILE = path.join(CACHE_DIR, 'issues.json');
const CACHE_METADATA_FILE = path.join(CACHE_DIR, 'metadata.json');
const SCORING_CACHE_FILE = path.join(CACHE_DIR, 'scoring.json');
const SCORING_METADATA_FILE = path.join(CACHE_DIR, 'scoring-metadata.json');

// Interface for cache metadata
interface CacheMetadata {
  lastUpdated: string;
  teamId: string;
  backlogStateId: string;
  issueCount: number;
}

// Interface for scoring cache metadata
interface ScoringCacheMetadata {
  lastUpdated: string;
  teamId: string;
  backlogStateId: string;
  issueCount: number;
  relevanceKeywords: string[];
}

/**
 * Ensures the cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  await fs.ensureDir(CACHE_DIR);
}

/**
 * Safely get a property from an object
 * @param obj The object to get the property from
 * @param prop The property to get
 * @returns The property value or undefined
 */
function safeGet<T, K extends keyof T>(obj: T | null | undefined, prop: K): T[K] | undefined {
  if (!obj) return undefined;
  return obj[prop];
}

/**
 * Safely await a promise or return the value directly
 * @param value The value to await if it's a promise
 * @returns The resolved value
 */
async function safeAwait<T>(value: T | Promise<T>): Promise<T> {
  if (value instanceof Promise) {
    return await value;
  }
  return value;
}

/**
 * Saves issues to the cache
 * @param issues The issues to cache
 * @param teamId The team ID
 * @param backlogStateId The backlog state ID
 */
export async function cacheIssues(issues: IssueConnection, teamId: string, backlogStateId: string): Promise<void> {
  const spinner = ora({
    text: chalk.blue('Saving issues to cache...'),
    color: 'blue'
  }).start();

  try {
    await ensureCacheDir();

    // Serialize the issues
    // We need to extract the data we need since the SDK objects aren't directly serializable
    const serializedIssues = await Promise.all(issues.nodes.map(async (issue) => {
      // Create a base issue object with properties we know exist
      const serializedIssue: any = {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        estimate: issue.estimate,
        priority: issue.priority,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        labels: [],
        comments: [],
        project: null
      };

      // Add labels if they exist
      try {
        if (issue.labels) {
          // Await the labels connection
          const labelsConnection = await issue.labels();
          if (labelsConnection && labelsConnection.nodes) {
            serializedIssue.labels = await Promise.all(labelsConnection.nodes.map(async (label) => ({
              id: label.id,
              name: label.name,
              color: label.color
            })));
          }
        }
      } catch (error) {
        console.error(chalk.yellow('Error processing labels:'), error);
      }

      // Add comments if they exist
      try {
        if (issue.comments) {
          // Await the comments connection
          const commentsConnection = await issue.comments();
          if (commentsConnection && commentsConnection.nodes) {
            serializedIssue.comments = await Promise.all(commentsConnection.nodes.map(async (comment) => {
              const commentObj: any = {
                id: comment.id,
                body: comment.body,
                user: null
              };

              // Add user if it exists
              if (comment.user) {
                const user = await safeAwait(comment.user);
                if (user) {
                  commentObj.user = {
                    id: user.id,
                    name: user.name,
                    email: user.email
                  };
                }
              }

              return commentObj;
            }));
          }
        }
      } catch (error) {
        console.error(chalk.yellow('Error processing comments:'), error);
      }

      // Add project if it exists
      try {
        if (issue.project) {
          const project = await safeAwait(issue.project);
          if (project) {
            serializedIssue.project = {
              id: project.id,
              name: project.name
            };
          }
        }
      } catch (error) {
        console.error(chalk.yellow('Error processing project:'), error);
      }

      return serializedIssue;
    }));

    // Save the serialized issues
    await fs.writeJson(ISSUES_CACHE_FILE, serializedIssues, { spaces: 2 });

    // Save metadata
    const metadata: CacheMetadata = {
      lastUpdated: new Date().toISOString(),
      teamId,
      backlogStateId,
      issueCount: issues.nodes.length
    };
    await fs.writeJson(CACHE_METADATA_FILE, metadata, { spaces: 2 });

    spinner.succeed(chalk.green(`Successfully cached ${issues.nodes.length} issues`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to cache issues'));
    console.error(chalk.red('Error details:'));
    if (error instanceof Error) {
      console.error(chalk.red(`  - ${error.message}`));
    } else {
      console.error(chalk.red(`  - ${String(error)}`));
    }
    throw error;
  }
}

/**
 * Checks if the cache exists and is valid
 * @param teamId The team ID to validate against
 * @param backlogStateId The backlog state ID to validate against
 * @param cacheTtlHours How many hours to consider the cache valid (default: 24)
 * @returns True if the cache exists and is valid, false otherwise
 */
export async function isCacheValid(
  teamId: string,
  backlogStateId: string,
  cacheTtlHours: number = 24
): Promise<boolean> {
  try {
    // Check if cache files exist
    const [issuesExist, metadataExist] = await Promise.all([
      fs.pathExists(ISSUES_CACHE_FILE),
      fs.pathExists(CACHE_METADATA_FILE)
    ]);

    if (!issuesExist || !metadataExist) {
      return false;
    }

    // Read metadata
    const metadata: CacheMetadata = await fs.readJson(CACHE_METADATA_FILE);

    // Check if the cache is for the same team and backlog state
    if (metadata.teamId !== teamId || metadata.backlogStateId !== backlogStateId) {
      return false;
    }

    // Check if the cache is recent (less than cacheTtlHours old)
    const lastUpdated = new Date(metadata.lastUpdated);
    const now = new Date();
    const cacheAgeHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    // Cache is valid if it's less than cacheTtlHours old
    return cacheAgeHours < cacheTtlHours;
  } catch (error) {
    console.error(chalk.yellow('Error checking cache validity:'), error);
    return false;
  }
}

/**
 * Gets the cache metadata
 * @returns The cache metadata or null if not available
 */
export async function getCacheMetadata(): Promise<CacheMetadata | null> {
  try {
    if (await fs.pathExists(CACHE_METADATA_FILE)) {
      return await fs.readJson(CACHE_METADATA_FILE);
    }
    return null;
  } catch (error) {
    console.error(chalk.yellow('Error reading cache metadata:'), error);
    return null;
  }
}

/**
 * Loads issues from the cache
 * @returns The cached issues or null if not available
 */
export async function loadCachedIssues(): Promise<any[] | null> {
  const spinner = ora({
    text: chalk.blue('Loading issues from cache...'),
    color: 'blue'
  }).start();

  try {
    if (await fs.pathExists(ISSUES_CACHE_FILE)) {
      const issues = await fs.readJson(ISSUES_CACHE_FILE);
      spinner.succeed(chalk.green(`Successfully loaded ${issues.length} issues from cache`));
      return issues;
    }
    spinner.fail(chalk.yellow('No cached issues found'));
    return null;
  } catch (error) {
    spinner.fail(chalk.red('Failed to load issues from cache'));
    console.error(chalk.red('Error details:'));
    if (error instanceof Error) {
      console.error(chalk.red(`  - ${error.message}`));
    } else {
      console.error(chalk.red(`  - ${String(error)}`));
    }
    return null;
  }
}

/**
 * Clears all caches
 */
export async function clearCache(): Promise<void> {
  const spinner = ora('Clearing all caches...').start();
  try {
    await ensureCacheDir();

    // Remove issues cache
    if (await fs.pathExists(ISSUES_CACHE_FILE)) {
      await fs.remove(ISSUES_CACHE_FILE);
    }
    if (await fs.pathExists(CACHE_METADATA_FILE)) {
      await fs.remove(CACHE_METADATA_FILE);
    }

    // Remove scoring cache
    if (await fs.pathExists(SCORING_CACHE_FILE)) {
      await fs.remove(SCORING_CACHE_FILE);
    }
    if (await fs.pathExists(SCORING_METADATA_FILE)) {
      await fs.remove(SCORING_METADATA_FILE);
    }

    spinner.succeed('All caches cleared successfully.');
  } catch (error) {
    spinner.fail(`Failed to clear caches: ${error}`);
    throw error;
  }
}

/**
 * Clears only the issues cache
 */
export async function clearIssuesCache(): Promise<void> {
  const spinner = ora('Clearing issues cache...').start();
  try {
    await ensureCacheDir();

    // Remove issues cache
    if (await fs.pathExists(ISSUES_CACHE_FILE)) {
      await fs.remove(ISSUES_CACHE_FILE);
    }
    if (await fs.pathExists(CACHE_METADATA_FILE)) {
      await fs.remove(CACHE_METADATA_FILE);
    }

    spinner.succeed('Issues cache cleared successfully.');
  } catch (error) {
    spinner.fail(`Failed to clear issues cache: ${error}`);
    throw error;
  }
}

/**
 * Clears only the scoring cache
 */
export async function clearScoringCache(): Promise<void> {
  const spinner = ora({
    text: chalk.blue('Clearing scoring cache...'),
    color: 'blue'
  }).start();

  try {
    await Promise.all([
      fs.remove(SCORING_CACHE_FILE),
      fs.remove(SCORING_METADATA_FILE)
    ]);
    spinner.succeed(chalk.green('Scoring cache cleared successfully'));
  } catch (error) {
    spinner.fail(chalk.red('Failed to clear scoring cache'));
    console.error(chalk.red('Error details:'));
    if (error instanceof Error) {
      console.error(chalk.red(`  - ${error.message}`));
    } else {
      console.error(chalk.red(`  - ${String(error)}`));
    }
  }
}

/**
 * Saves scored issues to the cache
 * @param scoredIssues The scored issues to cache
 * @param teamId The team ID
 * @param backlogStateId The backlog state ID
 * @param relevanceKeywords The relevance keywords used for scoring
 */
export async function cacheScoredIssues(
  scoredIssues: any[],
  teamId: string,
  backlogStateId: string,
  relevanceKeywords: string[]
): Promise<void> {
  const spinner = ora({
    text: chalk.blue('Saving scored issues to cache...'),
    color: 'blue'
  }).start();

  try {
    await ensureCacheDir();

    // Save the serialized scored issues
    await fs.writeJson(SCORING_CACHE_FILE, scoredIssues, { spaces: 2 });

    // Save metadata
    const metadata: ScoringCacheMetadata = {
      lastUpdated: new Date().toISOString(),
      teamId,
      backlogStateId,
      issueCount: scoredIssues.length,
      relevanceKeywords
    };
    await fs.writeJson(SCORING_METADATA_FILE, metadata, { spaces: 2 });

    spinner.succeed(chalk.green(`Successfully cached ${scoredIssues.length} scored issues`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to cache scored issues'));
    console.error(chalk.red('Error details:'));
    if (error instanceof Error) {
      console.error(chalk.red(`  - ${error.message}`));
    } else {
      console.error(chalk.red(`  - ${String(error)}`));
    }
    throw error;
  }
}

/**
 * Checks if the scoring cache exists and is valid
 * @param teamId The team ID to validate against
 * @param backlogStateId The backlog state ID to validate against
 * @param relevanceKeywords The relevance keywords to validate against
 * @param cacheTtlHours How many hours to consider the cache valid (default: 24)
 * @returns True if the cache exists and is valid, false otherwise
 */
export async function isScoringCacheValid(
  teamId: string,
  backlogStateId: string,
  relevanceKeywords: string[],
  cacheTtlHours: number = 24
): Promise<boolean> {
  try {
    // Check if cache files exist
    const [scoringExist, metadataExist] = await Promise.all([
      fs.pathExists(SCORING_CACHE_FILE),
      fs.pathExists(SCORING_METADATA_FILE)
    ]);

    if (!scoringExist || !metadataExist) {
      return false;
    }

    // Read metadata
    const metadata: ScoringCacheMetadata = await fs.readJson(SCORING_METADATA_FILE);

    // Check if the cache is for the same team and backlog state
    if (metadata.teamId !== teamId || metadata.backlogStateId !== backlogStateId) {
      return false;
    }

    // Check if the relevance keywords are the same
    // Sort both arrays to ensure consistent comparison
    const sortedCachedKeywords = [...metadata.relevanceKeywords].sort();
    const sortedCurrentKeywords = [...relevanceKeywords].sort();

    if (sortedCachedKeywords.length !== sortedCurrentKeywords.length) {
      return false;
    }

    for (let i = 0; i < sortedCachedKeywords.length; i++) {
      if (sortedCachedKeywords[i] !== sortedCurrentKeywords[i]) {
        return false;
      }
    }

    // Check if the cache is recent (less than cacheTtlHours old)
    const lastUpdated = new Date(metadata.lastUpdated);
    const now = new Date();
    const cacheAgeHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    // Cache is valid if it's less than cacheTtlHours old
    return cacheAgeHours < cacheTtlHours;
  } catch (error) {
    console.error(chalk.yellow('Error checking scoring cache validity:'), error);
    return false;
  }
}

/**
 * Gets the scoring cache metadata
 * @returns The scoring cache metadata or null if not available
 */
export async function getScoringCacheMetadata(): Promise<ScoringCacheMetadata | null> {
  try {
    if (await fs.pathExists(SCORING_METADATA_FILE)) {
      return await fs.readJson(SCORING_METADATA_FILE);
    }
    return null;
  } catch (error) {
    console.error(chalk.yellow('Error reading scoring cache metadata:'), error);
    return null;
  }
}

/**
 * Loads scored issues from the cache
 * @returns The cached scored issues or null if not available
 */
export async function loadCachedScoredIssues(): Promise<any[] | null> {
  const spinner = ora({
    text: chalk.blue('Loading scored issues from cache...'),
    color: 'blue'
  }).start();

  try {
    if (await fs.pathExists(SCORING_CACHE_FILE)) {
      const scoredIssues = await fs.readJson(SCORING_CACHE_FILE);
      spinner.succeed(chalk.green(`Successfully loaded ${scoredIssues.length} scored issues from cache`));
      return scoredIssues;
    }
    spinner.fail(chalk.yellow('No cached scored issues found'));
    return null;
  } catch (error) {
    spinner.fail(chalk.red('Failed to load scored issues from cache'));
    console.error(chalk.red('Error details:'));
    if (error instanceof Error) {
      console.error(chalk.red(`  - ${error.message}`));
    } else {
      console.error(chalk.red(`  - ${String(error)}`));
    }
    return null;
  }
}
