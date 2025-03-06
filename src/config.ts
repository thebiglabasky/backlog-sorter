import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configuration for the prioritizer
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

// Metabase employee aliases to identify internal vs external interactions
export const EMPLOYEE_ALIASES = process.env.LINEAR_EMPLOYEE_GITHUB_ALIASES ?
  process.env.LINEAR_EMPLOYEE_GITHUB_ALIASES.split(',') :
  [];

/**
 * Load configuration from environment variables
 */
export function loadConfig(): PrioritizerConfig {
  // Get configuration from environment variables
  const teamId = process.env.LINEAR_TEAM_ID;
  const backlogStateId = process.env.LINEAR_BACKLOG_STATE_ID;
  const targetInitiative = process.env.LINEAR_TARGET_INITIATIVE;
  const targetProject = process.env.LINEAR_TARGET_PROJECT;
  const relevanceKeywordsStr = process.env.LINEAR_RELEVANCE_KEYWORDS || '';
  const relevanceKeywords = relevanceKeywordsStr.split(',').map(k => k.trim()).filter(k => k.length > 0);

  // Get cache TTL from environment variables (default to 24 hours)
  const cacheTtlHours = parseInt(process.env.LINEAR_CACHE_TTL_HOURS || '24', 10);

  if (!teamId || !backlogStateId) {
    console.error(chalk.red('Error: Required environment variables are not set.'));
    console.error(chalk.gray('Please set LINEAR_TEAM_ID and LINEAR_BACKLOG_STATE_ID in your .env file.'));
    console.error(chalk.gray('Run with --env-help for more information.'));
    process.exit(1);
  }

  if (relevanceKeywords.length === 0) {
    console.warn(chalk.yellow('Warning: No relevance keywords provided. Using default scoring only.'));
  }

  return {
    teamId,
    backlogStateId,
    targetInitiative,
    targetProject,
    relevanceKeywords: relevanceKeywords.length > 0 ? relevanceKeywords : [
      'metadata', 'fingerprint', 'scan', 'sync', 'semantic type', 'database type',
      'binning', 'casting', 'field values'
    ],
    cacheTtlHours
  };
}

/**
 * Get API key from environment variables
 */
export function getApiKey(): string {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error(chalk.red('Error: LINEAR_API_KEY environment variable is not set.'));
    console.error(chalk.gray('Please set it in your .env file or environment variables.'));
    console.error(chalk.gray('Run with --env-help for more information.'));
    process.exit(1);
  }
  return apiKey;
}
