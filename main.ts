import { Issue, IssueConnection, LinearClient } from '@linear/sdk';
import chalk from 'chalk';
import dotenv from 'dotenv';
import ora from 'ora';
import {
  cacheIssues,
  cacheScoredIssues,
  clearCache,
  clearIssuesCache,
  clearScoringCache,
  getCacheMetadata,
  getScoringCacheMetadata,
  isCacheValid,
  isScoringCacheValid,
  loadCachedIssues,
  loadCachedScoredIssues
} from './cache-manager.js';

// Load environment variables from .env file
dotenv.config();

// Metabase employee aliases to identify internal vs external interactions
const EMPLOYEE_ALIASES = process.env.LINEAR_EMPLOYEE_GITHUB_ALIASES ?
  process.env.LINEAR_EMPLOYEE_GITHUB_ALIASES.split(',') :
  [];

// Configuration for the prioritizer
interface PrioritizerConfig {
  teamId: string;
  backlogStateId: string;
  targetInitiative?: string;
  targetProject?: string;
  relevanceKeywords: string[];
  cacheTtlHours: number;
}

// Helper types for our scoring system
interface IssueScore {
  issue: Issue;
  projectRelevance: number;
  valueScore: number;
  complexityScore: number;
  finalScore: number;
  analysisDetails: {
    relevanceKeywords: number;
    priority: string;
    recency: number;
    interactions: number;
    complexity: string;
  };
}

class LinearBacklogPrioritizer {
  private client: LinearClient;
  private config: PrioritizerConfig;
  private useCache: boolean;
  private forceRefresh: boolean;
  private useScoringCache: boolean;

  constructor(apiKey: string, config: PrioritizerConfig, options: {
    useCache: boolean,
    forceRefresh: boolean,
    useScoringCache: boolean
  } = {
    useCache: true,
    forceRefresh: false,
    useScoringCache: true
  }) {
    this.client = new LinearClient({ apiKey });
    this.config = config;
    this.useCache = options.useCache;
    this.forceRefresh = options.forceRefresh;
    this.useScoringCache = options.useScoringCache;

    // Set default keywords if not provided
    if (!this.config.relevanceKeywords || this.config.relevanceKeywords.length === 0) {
      this.config.relevanceKeywords = [
        'metadata', 'fingerprint', 'scan', 'sync', 'semantic type', 'database type',
        'binning', 'casting', 'field values'
      ];
    }
  }

  /**
   * Main function to prioritize and sort backlog issues
   */
  public async prioritizeBacklog(): Promise<IssueScore[]> {
    const spinner = ora({
      text: chalk.blue('Fetching backlog issues...'),
      color: 'blue'
    }).start();

    try {
      // Check if we should use cache
      let issues: IssueConnection | null = null;
      let cachedIssues: any[] | null = null;
      let cachedScoredIssues: any[] | null = null;

      // First check if we have a valid scoring cache and should use it
      if (this.useCache && this.useScoringCache && !this.forceRefresh) {
        const scoringCacheValid = await isScoringCacheValid(
          this.config.teamId,
          this.config.backlogStateId,
          this.config.relevanceKeywords,
          this.config.cacheTtlHours
        );

        if (scoringCacheValid) {
          spinner.text = chalk.blue('Loading scored issues from cache...');
          cachedScoredIssues = await loadCachedScoredIssues();

          if (cachedScoredIssues && cachedScoredIssues.length > 0) {
            spinner.succeed(chalk.green(`Loaded ${cachedScoredIssues.length} scored issues from cache.`));
            return cachedScoredIssues;
          }
        }
      }

      // If no valid scoring cache, check for issues cache
      if (this.useCache && !this.forceRefresh) {
        const cacheValid = await isCacheValid(
          this.config.teamId,
          this.config.backlogStateId,
          this.config.cacheTtlHours
        );

        if (cacheValid) {
          spinner.text = chalk.blue('Loading issues from cache...');
          cachedIssues = await loadCachedIssues();
        }
      }

      // If cache is not valid or we're forcing a refresh, fetch from API
      if (!cachedIssues) {
        spinner.text = chalk.blue('Fetching issues from Linear API...');
        issues = await this.fetchBacklogIssues();

        if (!issues.nodes.length) {
          spinner.fail(chalk.red('No backlog issues found.'));
          return [];
        }

        spinner.succeed(chalk.green(`Found ${issues.nodes.length} backlog issues.`));

        // Cache the issues if caching is enabled
        if (this.useCache) {
          await cacheIssues(issues, this.config.teamId, this.config.backlogStateId);
        }
      } else {
        spinner.succeed(chalk.green(`Loaded ${cachedIssues.length} issues from cache.`));
      }

      spinner.text = chalk.blue('Scoring and sorting issues...');
      spinner.start();

      let scoredIssues: IssueScore[];

      if (cachedIssues) {
        // Score issues from cache
        scoredIssues = await this.scoreIssuesFromCache(cachedIssues);
      } else if (issues) {
        // Score issues from API
        scoredIssues = await this.scoreIssues(issues.nodes);
      } else {
        throw new Error('No issues available to score');
      }

      const sortedIssues = this.sortIssuesByScore(scoredIssues);

      // Cache the scored issues if caching is enabled
      if (this.useCache) {
        await cacheScoredIssues(
          sortedIssues,
          this.config.teamId,
          this.config.backlogStateId,
          this.config.relevanceKeywords
        );
      }

      spinner.succeed(chalk.green('Successfully scored and sorted all issues!'));

      return sortedIssues;
    } catch (error) {
      spinner.fail(chalk.red('Error prioritizing backlog'));
      console.error(chalk.red('Detailed error information:'));
      if (error instanceof Error) {
        console.error(chalk.red(`  - Message: ${error.message}`));
        console.error(chalk.red(`  - Stack: ${error.stack}`));
      } else {
        console.error(chalk.red(`  - Unknown error: ${error}`));
      }
      throw error;
    }
  }

  /**
   * Optionally update the order of issues in Linear
   */
  public async updateIssueOrder(sortedIssues: IssueScore[]): Promise<void> {
    const spinner = ora({
      text: chalk.blue('Updating issue order in Linear...'),
      color: 'blue'
    }).start();

    try {
      let progress = 0;
      const total = sortedIssues.length;

      // Linear uses sortOrder for manual ordering of issues
      // Lower sortOrder values appear higher in the list
      for (let i = 0; i < sortedIssues.length; i++) {
        const issue = sortedIssues[i].issue;
        // Use a large enough step between values to allow for future insertions
        const sortOrder = (i + 1) * 100;

        spinner.text = chalk.blue(`Updating issues (${progress}/${total}): Setting ${issue.identifier} sort order to ${sortOrder}`);

        // Use the Linear client's updateIssue method to update the issue sort order
        await this.client.updateIssue(issue.id, { sortOrder });

        progress++;
      }

      spinner.succeed(chalk.green(`Successfully updated ${total} issue sort orders in Linear!`));
    } catch (error) {
      spinner.fail(chalk.red('Error updating issue order'));
      console.error(chalk.red('Detailed error information:'));
      if (error instanceof Error) {
        console.error(chalk.red(`  - Message: ${error.message}`));
        console.error(chalk.red(`  - Stack: ${error.stack}`));
      } else {
        console.error(chalk.red(`  - Unknown error: ${error}`));
      }
      throw error;
    }
  }

  /**
   * Fetch all backlog issues from Linear for the specified team
   */
  private async fetchBacklogIssues(): Promise<IssueConnection> {
    try {
      // Get the backlog workflow state for the team
      const team = await this.client.team(this.config.teamId);
      if (!team) {
        throw new Error(`Team with ID ${this.config.teamId} not found`);
      }

      // Fetch issues in backlog state
      const issues = await this.client.issues({
        filter: {
          team: { id: { eq: this.config.teamId } },
          state: { id: { eq: this.config.backlogStateId } }
        },
        includeArchived: false,
        first: 100 // Adjust if you have more than 100 issues
      });

      return issues;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          throw new Error(`Failed to fetch backlog issues: Team or state ID not found. Please check your configuration.`);
        } else if (error.message.includes('authentication')) {
          throw new Error(`Authentication error: Please check your LINEAR_API_KEY environment variable.`);
        }
      }
      throw new Error(`Failed to fetch backlog issues: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Score issues based on the prioritization criteria
   */
  private async scoreIssues(issues: Issue[]): Promise<IssueScore[]> {
    const scoredIssues: IssueScore[] = [];
    const spinner = ora({
      text: chalk.blue(`Scoring issue 0/${issues.length}...`),
      color: 'blue'
    }).start();

    try {
      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        spinner.text = chalk.blue(`Scoring issue ${i + 1}/${issues.length}: ${issue.identifier}`);

        // Get comments for interaction analysis
        const comments = await issue.comments();

        // Extract priority from issue labels
        const priorityLabel = await this.extractPriority(issue);
        let priorityScore = 0;

        if (priorityLabel === 'P1') priorityScore = 100;
        else if (priorityLabel === 'P2') priorityScore = 70;
        else if (priorityLabel === 'P3') priorityScore = 40;

        // Calculate project relevance (highest priority)
        const projectRelevance = await this.calculateProjectRelevance(issue);

        // Calculate value components
        const recencyValue = this.calculateRecencyScore(issue.updatedAt);
        const interactionsValue = this.estimateInteractions(issue, comments);
        const valueScore = (priorityScore * 0.5) + (recencyValue * 0.3) + (interactionsValue * 0.2);

        // Estimate complexity (prefer simpler issues)
        const complexity = await this.estimateComplexity(issue);
        let complexityScore = 0;

        if (complexity === 'Low') complexityScore = 100;
        else if (complexity === 'Medium') complexityScore = 70;
        else if (complexity === 'High') complexityScore = 40;
        else complexityScore = 70; // Default to medium

        // Final score weighted according to priorities
        // Project relevance (50%) + value (30%) + inverse complexity (20%)
        const finalScore = (projectRelevance * 0.5) + (valueScore * 0.3) + (complexityScore * 0.2);

        scoredIssues.push({
          issue,
          projectRelevance,
          valueScore,
          complexityScore,
          finalScore,
          analysisDetails: {
            relevanceKeywords: Math.round(projectRelevance / 10), // Approx keyword count
            priority: priorityLabel,
            recency: recencyValue,
            interactions: interactionsValue,
            complexity
          }
        });
      }

      spinner.succeed(chalk.green(`Successfully scored all ${issues.length} issues`));
      return scoredIssues;
    } catch (error) {
      spinner.fail(chalk.red(`Error scoring issues`));
      if (error instanceof Error) {
        throw new Error(`Failed to score issues: ${error.message}`);
      }
      throw new Error(`Failed to score issues: ${String(error)}`);
    }
  }

  /**
   * Extract priority label from issue labels
   */
  private async extractPriority(issue: Issue): Promise<string> {
    // Get labels - we need to await the labels fetch and then access nodes
    const labelsConnection = await issue.labels();
    const labels = labelsConnection.nodes || [];

    // Look for priority labels
    for (const label of labels) {
      if (label.name.startsWith('Priority:P1')) return 'P1';
      if (label.name.startsWith('Priority:P2')) return 'P2';
      if (label.name.startsWith('Priority:P3')) return 'P3';
    }

    return 'P3'; // Default to P3 if no priority label found
  }

  /**
   * Calculate project relevance score based on initiative, project, and keywords
   */
  private async calculateProjectRelevance(issue: Issue): Promise<number> {
    // Check if issue is part of the target initiative
    if (this.config.targetInitiative && issue.project) {
      const project = await issue.project;
      if (project.name === this.config.targetInitiative) {
        return 100;
      }
    }

    // Check if issue is part of the target project
    if (this.config.targetProject && issue.project) {
      const project = await issue.project;
      if (project.name === this.config.targetProject) {
        return 90;
      }
    }

    let keywordCount = 0;

    // Check title for keywords
    if (issue.title) {
      keywordCount += this.config.relevanceKeywords.filter(keyword =>
        issue.title.toLowerCase().includes(keyword.toLowerCase())
      ).length * 2; // Title matches weighted more heavily
    }

    // Check description for keywords
    if (issue.description) {
      keywordCount += this.config.relevanceKeywords.filter(keyword =>
        issue.description?.toLowerCase().includes(keyword.toLowerCase())
      ).length;
    }

    // Check labels for relevance
    const labelsConnection = await issue.labels();
    const labels = labelsConnection.nodes || [];
    const relevantLabelKeywords = [
      'semantic layer', 'fingerprint', 'scan', 'sync',
      'metadata', 'administration'
    ];

    for (const label of labels) {
      keywordCount += relevantLabelKeywords.filter(keyword =>
        label.name.toLowerCase().includes(keyword.toLowerCase())
      ).length * 3; // Labels are most heavily weighted
    }

    // Convert keyword count to a score from 0-80
    return Math.min(80, keywordCount * 10);
  }

  /**
   * Calculate recency score (more recent = higher score)
   */
  private calculateRecencyScore(date: string | Date | null): number {
    if (!date) return 0;

    const updatedDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const ageInDays = (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);

    // More recent issues get higher scores
    return Math.max(0, 100 - ageInDays);
  }

  /**
   * Estimate interactions, giving more weight to user interactions vs employee interactions
   */
  private estimateInteractions(issue: Issue, comments: any): number {
    // Count total comments
    const totalComments = comments.nodes.length;

    // Count employee vs user comments
    let employeeComments = 0;
    let userComments = 0;

    for (const comment of comments.nodes) {
      const commenterEmail = comment.user?.email || '';
      const commenterName = comment.user?.name || '';

      // Check if commenter is a Metabase employee
      if (commenterEmail.includes('@metabase.com') ||
          EMPLOYEE_ALIASES.some(alias =>
            commenterName.toLowerCase().includes(alias.toLowerCase()))) {
        employeeComments++;
      } else {
        userComments++;
      }
    }

    // Weight user comments 3x more than employee comments
    const weightedInteractionScore = (userComments * 3) + employeeComments;

    // Convert to a 0-100 scale, capping at 100
    return Math.min(100, weightedInteractionScore * 10);
  }

  /**
   * Estimate complexity based on description length, labels, and estimate value
   */
  private async estimateComplexity(issue: Issue): Promise<string> {
    // Check if issue has an estimate
    if (issue.estimate) {
      // Use the estimate value to determine complexity
      if (issue.estimate > 8) return 'High';
      if (issue.estimate > 3) return 'Medium';
      return 'Low';
    }

    // Check for complexity labels
    const labelsConnection = await issue.labels();
    const labels = labelsConnection.nodes || [];
    for (const label of labels) {
      if (label.name.toLowerCase().includes('complex')) return 'High';
      if (label.name.toLowerCase().includes('medium')) return 'Medium';
      if (label.name.toLowerCase().includes('simple')) return 'Low';
    }

    // Use description length as a fallback
    const descLength = issue.description ? issue.description.length : 0;
    if (descLength > 2000) return 'High';
    if (descLength > 800) return 'Medium';
    return 'Low';
  }

  /**
   * Sort issues by their final score in descending order
   */
  private sortIssuesByScore(scoredIssues: IssueScore[]): IssueScore[] {
    return [...scoredIssues].sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Score issues from cached data
   */
  private async scoreIssuesFromCache(cachedIssues: any[]): Promise<IssueScore[]> {
    const scoredIssues: IssueScore[] = [];
    const spinner = ora({
      text: chalk.blue(`Scoring issue 0/${cachedIssues.length}...`),
      color: 'blue'
    }).start();

    try {
      for (let i = 0; i < cachedIssues.length; i++) {
        const cachedIssue = cachedIssues[i];
        spinner.text = chalk.blue(`Scoring issue ${i + 1}/${cachedIssues.length}: ${cachedIssue.identifier}`);

        // Extract priority from cached labels
        const priorityLabel = this.extractPriorityFromCache(cachedIssue);
        let priorityScore = 0;

        if (priorityLabel === 'P1') priorityScore = 100;
        else if (priorityLabel === 'P2') priorityScore = 70;
        else if (priorityLabel === 'P3') priorityScore = 40;

        // Calculate project relevance (highest priority)
        const projectRelevance = this.calculateProjectRelevanceFromCache(cachedIssue);

        // Calculate value components
        const recencyValue = this.calculateRecencyScore(cachedIssue.updatedAt);
        const interactionsValue = this.estimateInteractionsFromCache(cachedIssue);
        const valueScore = (priorityScore * 0.5) + (recencyValue * 0.3) + (interactionsValue * 0.2);

        // Estimate complexity
        const complexity = this.estimateComplexityFromCache(cachedIssue);
        let complexityScore = 0;

        if (complexity === 'Low') complexityScore = 100;
        else if (complexity === 'Medium') complexityScore = 70;
        else if (complexity === 'High') complexityScore = 40;
        else complexityScore = 70; // Default to medium

        // Final score weighted according to priorities
        // Project relevance (50%) + value (30%) + inverse complexity (20%)
        const finalScore = (projectRelevance * 0.5) + (valueScore * 0.3) + (complexityScore * 0.2);

        scoredIssues.push({
          issue: cachedIssue,
          projectRelevance,
          valueScore,
          complexityScore,
          finalScore,
          analysisDetails: {
            relevanceKeywords: Math.round(projectRelevance / 10), // Approx keyword count
            priority: priorityLabel,
            recency: recencyValue,
            interactions: interactionsValue,
            complexity
          }
        });
      }

      spinner.succeed(chalk.green(`Successfully scored all ${cachedIssues.length} issues`));
      return scoredIssues;
    } catch (error) {
      spinner.fail(chalk.red(`Error scoring issues from cache`));
      if (error instanceof Error) {
        throw new Error(`Failed to score issues from cache: ${error.message}`);
      }
      throw new Error(`Failed to score issues from cache: ${String(error)}`);
    }
  }

  /**
   * Extract priority label from cached issue labels
   */
  private extractPriorityFromCache(cachedIssue: any): string {
    const labels = cachedIssue.labels || [];

    // Look for priority labels
    for (const label of labels) {
      if (label.name.startsWith('Priority:P1')) return 'P1';
      if (label.name.startsWith('Priority:P2')) return 'P2';
      if (label.name.startsWith('Priority:P3')) return 'P3';
    }

    return 'P3'; // Default to P3 if no priority label found
  }

  /**
   * Calculate project relevance score based on initiative, project, and keywords from cached data
   */
  private calculateProjectRelevanceFromCache(cachedIssue: any): number {
    // Check if issue is part of the target initiative
    if (this.config.targetInitiative && cachedIssue.project) {
      if (cachedIssue.project.name === this.config.targetInitiative) {
        return 100;
      }
    }

    // Check if issue is part of the target project
    if (this.config.targetProject && cachedIssue.project) {
      if (cachedIssue.project.name === this.config.targetProject) {
        return 90;
      }
    }

    let keywordCount = 0;

    // Check title for keywords
    if (cachedIssue.title) {
      keywordCount += this.config.relevanceKeywords.filter(keyword =>
        cachedIssue.title.toLowerCase().includes(keyword.toLowerCase())
      ).length * 2; // Title matches weighted more heavily
    }

    // Check description for keywords
    if (cachedIssue.description) {
      keywordCount += this.config.relevanceKeywords.filter(keyword =>
        cachedIssue.description?.toLowerCase().includes(keyword.toLowerCase())
      ).length;
    }

    // Check labels for relevance
    const labels = cachedIssue.labels || [];
    const relevantLabelKeywords = [
      'semantic layer', 'fingerprint', 'scan', 'sync',
      'metadata', 'administration'
    ];

    for (const label of labels) {
      keywordCount += relevantLabelKeywords.filter(keyword =>
        label.name.toLowerCase().includes(keyword.toLowerCase())
      ).length * 3; // Labels are most heavily weighted
    }

    // Convert keyword count to a score from 0-80
    return Math.min(80, keywordCount * 10);
  }

  /**
   * Estimate interactions from cached data
   */
  private estimateInteractionsFromCache(cachedIssue: any): number {
    const comments = cachedIssue.comments || [];

    // Count employee vs user comments
    let employeeComments = 0;
    let userComments = 0;

    for (const comment of comments) {
      const commenterEmail = comment.user?.email || '';
      const commenterName = comment.user?.name || '';

      // Check if commenter is a Metabase employee
      if (commenterEmail.includes('@metabase.com') ||
          EMPLOYEE_ALIASES.some(alias =>
            commenterName.toLowerCase().includes(alias.toLowerCase()))) {
        employeeComments++;
      } else {
        userComments++;
      }
    }

    // Weight user comments 3x more than employee comments
    const weightedInteractionScore = (userComments * 3) + employeeComments;

    // Convert to a 0-100 scale, capping at 100
    return Math.min(100, weightedInteractionScore * 10);
  }

  /**
   * Estimate complexity from cached data
   */
  private estimateComplexityFromCache(cachedIssue: any): string {
    // Check if issue has an estimate
    if (cachedIssue.estimate) {
      // Use the estimate value to determine complexity
      if (cachedIssue.estimate > 8) return 'High';
      if (cachedIssue.estimate > 3) return 'Medium';
      return 'Low';
    }

    // Check for complexity labels
    const labels = cachedIssue.labels || [];
    for (const label of labels) {
      if (label.name.toLowerCase().includes('complex')) return 'High';
      if (label.name.toLowerCase().includes('medium')) return 'Medium';
      if (label.name.toLowerCase().includes('simple')) return 'Low';
    }

    // Use description length as a fallback
    const descLength = cachedIssue.description ? cachedIssue.description.length : 0;
    if (descLength > 2000) return 'High';
    if (descLength > 800) return 'Medium';
    return 'Low';
  }
}

// Example usage
async function main() {
  console.log(chalk.bold.blue('Linear Backlog Prioritizer'));
  console.log(chalk.gray('==============================\n'));

  // Parse command line arguments
  const args = process.argv.slice(2);
  const shouldUpdateOrder = args.includes("--update");
  const scoreOnly = args.includes("--score-only");
  const showScores = args.includes("--show-scores");
  const showStats = args.includes("--stats");
  const noCache = args.includes("--no-cache");
  const noScoringCache = args.includes("--no-scoring-cache");
  const forceRefresh = args.includes("--refresh");
  const clearCacheFlag = args.includes("--clear-cache");
  const clearScoringCacheFlag = args.includes("--clear-scoring-cache");
  const clearIssuesCacheFlag = args.includes("--clear-issues-cache");
  const showDebug = args.includes("--debug");
  const showCacheInfo = args.includes("--cache-info");
  const showScoringCacheInfo = args.includes("--scoring-cache-info");
  const showHelp = args.includes("--help") || args.includes("-h");
  const showEnvHelp = args.includes("--env-help");

  // Show help message
  if (showHelp) {
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
    process.exit(0);
  }

  // Show environment variable help
  if (showEnvHelp) {
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
    process.exit(0);
  }

  // Handle cache management commands
  if (clearCacheFlag) {
    await clearCache();
    if (!forceRefresh) {
      process.exit(0);
    }
  }

  if (clearScoringCacheFlag) {
    await clearScoringCache();
    if (!forceRefresh) {
      process.exit(0);
    }
  }

  if (clearIssuesCacheFlag) {
    await clearIssuesCache();
    if (!forceRefresh) {
      process.exit(0);
    }
  }

  if (showCacheInfo) {
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

    if (!forceRefresh) {
      process.exit(0);
    }
  }

  if (showScoringCacheInfo) {
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

    if (!forceRefresh) {
      process.exit(0);
    }
  }

  // Get API key from environment variables
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error(chalk.red('Error: LINEAR_API_KEY environment variable is not set.'));
    console.error(chalk.gray('Please set it in your .env file or environment variables.'));
    console.error(chalk.gray('Run with --env-help for more information.'));
    process.exit(1);
  }

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

  // Create prioritizer instance
  const config: PrioritizerConfig = {
    teamId,
    backlogStateId,
    targetInitiative,
    targetProject,
    relevanceKeywords,
    cacheTtlHours
  };

  const prioritizer = new LinearBacklogPrioritizer(
    apiKey,
    config,
    {
      useCache: !noCache,
      forceRefresh,
      useScoringCache: !noScoringCache
    }
  );

  try {
    // Handle show-scores command (just display cached scores without recomputing)
    if (showScores) {
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

    // Prioritize the backlog
    const sortedIssues = await prioritizer.prioritizeBacklog();

    if (sortedIssues.length === 0) {
      console.log(chalk.yellow('No issues to prioritize.'));
      return;
    }

    // Always show all sorted issues
    console.log(chalk.yellow("\nSorted Issues:"));
    sortedIssues.forEach((item, index) => {
      console.log(`${chalk.cyan(`${index + 1}.`)} [${chalk.bold(item.issue.identifier)}] ${item.issue.title} - Score: ${chalk.green(item.finalScore.toFixed(1))}`);
    });

    // Show more detailed results
    if (showDebug) {
      console.log(chalk.yellow("\nDetailed scoring results:"));
      sortedIssues.forEach((item, index) => {
        console.log(chalk.cyan(`\n${index + 1}. [${item.issue.identifier}] ${item.issue.title}`));
        console.log(chalk.gray(`   - Final Score: ${item.finalScore.toFixed(1)}`));
        console.log(chalk.gray(`   - Project Relevance: ${item.projectRelevance.toFixed(1)}`));
        console.log(chalk.gray(`   - Value Score: ${item.valueScore.toFixed(1)}`));
        console.log(chalk.gray(`   - Complexity Score: ${item.complexityScore.toFixed(1)}`));
        console.log(chalk.gray(`   - Analysis Details:`));
        console.log(chalk.gray(`     - Relevance Keywords: ${item.analysisDetails.relevanceKeywords}`));
        console.log(chalk.gray(`     - Priority: ${item.analysisDetails.priority}`));
        console.log(chalk.gray(`     - Recency: ${item.analysisDetails.recency.toFixed(1)}`));
        console.log(chalk.gray(`     - Interactions: ${item.analysisDetails.interactions}`));
        console.log(chalk.gray(`     - Complexity: ${item.analysisDetails.complexity}`));
      });
    }

    // Show statistics if requested
    if (showStats) {
      // Calculate average scores
      const avgFinalScore = sortedIssues.reduce((sum, item) => sum + item.finalScore, 0) / sortedIssues.length;
      const avgRelevance = sortedIssues.reduce((sum, item) => sum + item.projectRelevance, 0) / sortedIssues.length;
      const avgValue = sortedIssues.reduce((sum, item) => sum + item.valueScore, 0) / sortedIssues.length;
      const avgComplexity = sortedIssues.reduce((sum, item) => sum + item.complexityScore, 0) / sortedIssues.length;

      // Count priorities
      const priorities = sortedIssues.reduce((counts, item) => {
        const priority = item.analysisDetails.priority;
        counts[priority] = (counts[priority] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      // Count complexities
      const complexities = sortedIssues.reduce((counts, item) => {
        const complexity = item.analysisDetails.complexity;
        counts[complexity] = (counts[complexity] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      console.log(chalk.yellow("\nScoring Statistics:"));
      console.log(chalk.gray(`  - Total Issues: ${sortedIssues.length}`));
      console.log(chalk.gray(`  - Average Final Score: ${avgFinalScore.toFixed(1)}`));
      console.log(chalk.gray(`  - Average Project Relevance: ${avgRelevance.toFixed(1)}`));
      console.log(chalk.gray(`  - Average Value Score: ${avgValue.toFixed(1)}`));
      console.log(chalk.gray(`  - Average Complexity Score: ${avgComplexity.toFixed(1)}`));

      console.log(chalk.gray(`  - Priority Distribution:`));
      Object.entries(priorities).sort().forEach(([priority, count]) => {
        console.log(chalk.gray(`    - ${priority}: ${count} issues (${(count / sortedIssues.length * 100).toFixed(1)}%)`));
      });

      console.log(chalk.gray(`  - Complexity Distribution:`));
      Object.entries(complexities).sort().forEach(([complexity, count]) => {
        console.log(chalk.gray(`    - ${complexity}: ${count} issues (${(count / sortedIssues.length * 100).toFixed(1)}%)`));
      });

      // Show score ranges
      const minScore = Math.min(...sortedIssues.map(item => item.finalScore));
      const maxScore = Math.max(...sortedIssues.map(item => item.finalScore));
      console.log(chalk.gray(`  - Score Range: ${minScore.toFixed(1)} - ${maxScore.toFixed(1)}`));
    }

    // Update the order in Linear if requested
    if (shouldUpdateOrder && !scoreOnly) {
      console.log(chalk.yellow("\nUpdating issue order in Linear..."));
      await prioritizer.updateIssueOrder(sortedIssues);
      console.log(chalk.green("Successfully updated issue order in Linear!"));
    } else if (scoreOnly) {
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
if (process.argv[1].endsWith('main.ts') || process.argv[1].endsWith('main.js')) {
  main().catch(console.error);
}

// Export for use as a module
export { IssueScore, LinearBacklogPrioritizer, PrioritizerConfig };
