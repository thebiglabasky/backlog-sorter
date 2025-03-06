import chalk from 'chalk';
import ora from 'ora';
import { cacheIssues, isCacheValid, loadCachedIssues } from './cache-manager.js';
export class IssueFetcher {
    constructor(client, config, useCache = true, forceRefresh = false) {
        this.client = client;
        this.config = config;
        this.useCache = useCache;
        this.forceRefresh = forceRefresh;
    }
    /**
     * Fetch backlog issues from Linear API or cache
     */
    async fetchIssues() {
        const spinner = ora({
            text: chalk.blue('Fetching backlog issues...'),
            color: 'blue'
        }).start();
        try {
            // Check if we should use cache
            let issues = null;
            let cachedIssues = null;
            // If cache is enabled and not forcing refresh, check for valid cache
            if (this.useCache && !this.forceRefresh) {
                const cacheValid = await isCacheValid(this.config.teamId, this.config.backlogStateId, this.config.cacheTtlHours);
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
                return issues.nodes;
            }
            else {
                spinner.succeed(chalk.green(`Loaded ${cachedIssues.length} issues from cache.`));
                return cachedIssues.map(issue => issue);
            }
        }
        catch (error) {
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
    async fetchBacklogIssues() {
        try {
            // Get the backlog workflow state for the team
            const team = await this.client.team(this.config.teamId);
            if (!team) {
                throw new Error(`Team with ID ${this.config.teamId} not found`);
            }
            // Fetch issues in backlog state
            const issuesQuery = {
                filter: {
                    team: { id: { eq: this.config.teamId } },
                    state: { id: { eq: this.config.backlogStateId } }
                }
            };
            // Add initiative filter if specified
            if (this.config.targetInitiative) {
                issuesQuery.filter = {
                    ...issuesQuery.filter,
                    initiative: { name: { eq: this.config.targetInitiative } }
                };
            }
            // Add project filter if specified
            if (this.config.targetProject) {
                issuesQuery.filter = {
                    ...issuesQuery.filter,
                    project: { name: { eq: this.config.targetProject } }
                };
            }
            // Fetch issues with comments and labels
            const issues = await this.client.issues(issuesQuery);
            return issues;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch backlog issues: ${error.message}`);
            }
            throw new Error(`Failed to fetch backlog issues: ${String(error)}`);
        }
    }
}
