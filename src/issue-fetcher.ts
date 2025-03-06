import { LinearClient } from '@linear/sdk';
import chalk from 'chalk';
import ora from 'ora';
import {
  cacheIssues,
  isCacheValid,
  loadCachedIssues
} from './cache-manager.js';
import { PrioritizerConfig } from './config.js';

/**
 * Helper function to delay execution
 * @param ms Milliseconds to delay
 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Define a custom interface for our enriched issue data
export interface EnrichedIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority?: number;
  createdAt: string;
  updatedAt: string;
  labels: Array<{ id: string; name: string; color?: string }>;
  comments: Array<{
    id: string;
    body: string;
    createdAt?: string;
    user?: {
      id: string;
      name: string;
      email?: string;
      displayName?: string;
      organization?: {
        id: string;
        name: string;
      } | null;
    } | null;
  }>;
}

export class IssueFetcher {
  private client: LinearClient;
  private config: PrioritizerConfig;
  private useCache: boolean;
  private forceRefresh: boolean;

  constructor(
    client: LinearClient,
    config: PrioritizerConfig,
    useCache: boolean = true,
    forceRefresh: boolean = false
  ) {
    this.client = client;
    this.config = config;
    this.useCache = useCache;
    this.forceRefresh = forceRefresh;
  }

  /**
   * Fetch backlog issues from Linear API or cache
   */
  public async fetchIssues(): Promise<EnrichedIssue[]> {
    const spinner = ora({
      text: chalk.blue('Fetching backlog issues...'),
      color: 'blue'
    }).start();

    try {
      // Check if we should use cache
      let enrichedIssues: EnrichedIssue[] | null = null;
      let cachedIssues: any[] | null = null;

      // If cache is enabled and not forcing refresh, check for valid cache
      if (this.useCache && !this.forceRefresh) {
        const cacheValid = await isCacheValid(
          this.config.teamId,
          this.config.backlogStateId,
          this.config.cacheTtlHours
        );

        if (cacheValid) {
          spinner.text = chalk.blue('Loading issues from cache...');
          cachedIssues = await loadCachedIssues();
          if (cachedIssues) {
            enrichedIssues = cachedIssues as EnrichedIssue[];
          }
        }
      }

      // If cache is not valid or we're forcing a refresh, fetch from API
      if (!enrichedIssues) {
        spinner.text = chalk.blue('Fetching issues from Linear API...');
        enrichedIssues = await this.fetchBacklogIssues();

        if (!enrichedIssues.length) {
          spinner.fail(chalk.red('No backlog issues found.'));
          return [];
        }

        spinner.succeed(chalk.green(`Found ${enrichedIssues.length} backlog issues.`));

        // Cache the issues if caching is enabled
        if (this.useCache) {
          await cacheIssues(enrichedIssues, this.config.teamId, this.config.backlogStateId);
        }

        return enrichedIssues;
      } else {
        spinner.succeed(chalk.green(`Loaded ${enrichedIssues.length} issues from cache.`));
        return enrichedIssues;
      }
    } catch (error) {
      spinner.fail(chalk.red('Error fetching backlog issues'));
      if (error instanceof Error) {
        throw new Error(`Failed to fetch backlog issues: ${error.message}`);
      }
      throw new Error(`Failed to fetch backlog issues: ${String(error)}`);
    }
  }

  /**
   * Fetch all backlog issues from Linear for the specified team
   */
  private async fetchBacklogIssues(): Promise<EnrichedIssue[]> {
    try {
      // Get the backlog workflow state for the team
      const team = await this.client.team(this.config.teamId);
      if (!team) {
        throw new Error(`Team with ID ${this.config.teamId} not found`);
      }

      // Add a delay to avoid rate limiting
      await delay(2000);

      // Use the raw GraphQL client to fetch all issue data in a single query
      const graphQLClient = (this.client as any).client;

      // Comprehensive GraphQL query to fetch all needed data at once
      const result = await graphQLClient.rawRequest(`
        query BacklogIssues($teamId: ID!, $stateId: ID!) {
          issues(
            filter: {
              team: { id: { eq: $teamId } },
              state: { id: { eq: $stateId } }
            }
          ) {
            nodes {
              id
              identifier
              title
              description
              priority
              createdAt
              updatedAt
              labels {
                nodes {
                  id
                  name
                  color
                }
              }
              comments {
                nodes {
                  id
                  body
                  createdAt
                  user {
                    id
                    name
                    email
                    displayName
                    organization {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      `, {
        teamId: this.config.teamId,
        stateId: this.config.backlogStateId
      });

      if (!result.data || !result.data.issues || !result.data.issues.nodes) {
        throw new Error('No data returned from Linear API');
      }

      // Transform the raw GraphQL response into our EnrichedIssue format
      const enrichedIssues: EnrichedIssue[] = result.data.issues.nodes.map((node: any) => {
        return {
          id: node.id,
          identifier: node.identifier,
          title: node.title,
          description: node.description,
          priority: node.priority,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
          labels: node.labels?.nodes || [],
          comments: node.comments?.nodes || []
        };
      });

      return enrichedIssues;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch backlog issues: ${error.message}`);
      }
      throw new Error(`Failed to fetch backlog issues: ${String(error)}`);
    }
  }

  /**
   * Fetch comments with detailed user information for an issue
   */
  private async fetchCommentsWithUserInfo(issueId: string): Promise<any> {
    try {
      console.log(chalk.gray(`Fetching comments for issue ${issueId}...`));

      // Use the raw GraphQL client to fetch comments with detailed user information
      const graphQLClient = (this.client as any).client;

      // Simplified query to reduce potential errors
      const result = await graphQLClient.rawRequest(`
        query IssueComments($issueId: String!) {
          issue(id: $issueId) {
            comments {
              nodes {
                id
                body
                user {
                  id
                  name
                  email
                  displayName
                  organization {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      `, {
        issueId
      });

      if (!result.data || !result.data.issue || !result.data.issue.comments) {
        console.error(chalk.yellow(`Warning: No comments data returned for issue ${issueId}`));
        return { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
      }

      // Return the comments connection
      return result.data.issue.comments;
    } catch (error) {
      console.error(chalk.red(`Error fetching comments for issue ${issueId}:`));
      if (error instanceof Error) {
        console.error(chalk.red(`  - ${error.message}`));
      } else {
        console.error(chalk.red(`  - ${String(error)}`));
      }

      // Return an empty comments connection as fallback
      return { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
    }
  }
}
