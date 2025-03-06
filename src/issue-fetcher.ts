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
  estimate: number;
  project: {
    id: string;
    name: string;
  } | null;
  labels: Array<{ id: string; name: string; color?: string }>;
  comments: Array<{
    id: string;
    body: string;
    createdAt?: string;
    user?: {
      id: string;
      email: string;
      displayName?: string;
    } | null;
  }>;
}

export class IssueFetcher {
  private client: LinearClient;
  private config: PrioritizerConfig;
  private useCache: boolean;

  constructor(
    client: LinearClient,
    config: PrioritizerConfig,
    useCache: boolean = true
  ) {
    this.client = client;
    this.config = config;
    this.useCache = useCache;
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
      if (this.useCache) {
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

      // Use the raw GraphQL client to fetch all issue data in a single query
      const graphQLClient = (this.client as any).client;

      // Comprehensive GraphQL query to fetch all needed data at once
      const result = await graphQLClient.rawRequest(`
        query BacklogIssues($teamId: ID!, $stateId: ID!) {
          issues(
            first: 200,
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
              estimate
              createdAt
              updatedAt
              project {
                id
                name
              }
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
                    email
                    displayName
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
          estimate: node.estimate,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
          labels: node.labels?.nodes || [],
          comments: node.comments?.nodes || [],
          project: node.project || null
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

}
