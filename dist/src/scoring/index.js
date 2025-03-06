import chalk from 'chalk';
import ora from 'ora';
import { cacheScoredIssues, isScoringCacheValid, loadCachedScoredIssues } from '../cache-manager.js';
import { calculateIssueScore, sortIssuesByScore } from './calculator.js';
export class IssueScorer {
    constructor(config, useCache = true, forceRefresh = false) {
        this.config = config;
        this.useCache = useCache;
        this.forceRefresh = forceRefresh;
    }
    /**
     * Score and sort issues
     */
    async scoreIssues(issues) {
        const spinner = ora({
            text: chalk.blue(`Scoring issue 0/${issues.length}...`),
            color: 'blue'
        }).start();
        try {
            // Check if we should use scoring cache
            if (this.useCache && !this.forceRefresh) {
                const scoringCacheValid = await isScoringCacheValid(this.config.teamId, this.config.backlogStateId, this.config.relevanceKeywords, this.config.cacheTtlHours);
                if (scoringCacheValid) {
                    spinner.text = chalk.blue('Loading scored issues from cache...');
                    const cachedScoredIssues = await loadCachedScoredIssues();
                    if (cachedScoredIssues && cachedScoredIssues.length > 0) {
                        spinner.succeed(chalk.green(`Loaded ${cachedScoredIssues.length} scored issues from cache.`));
                        return cachedScoredIssues;
                    }
                }
            }
            // Score issues
            const scoredIssues = [];
            for (let i = 0; i < issues.length; i++) {
                const issue = issues[i];
                spinner.text = chalk.blue(`Scoring issue ${i + 1}/${issues.length}: ${issue.identifier}`);
                // Get comments for interaction analysis
                const comments = await issue.comments();
                // Calculate issue score
                const score = await calculateIssueScore(issue, this.config.relevanceKeywords, comments);
                scoredIssues.push(score);
            }
            // Sort issues by score
            const sortedIssues = sortIssuesByScore(scoredIssues);
            // Cache the scored issues if caching is enabled
            if (this.useCache) {
                await cacheScoredIssues(sortedIssues, this.config.teamId, this.config.backlogStateId, this.config.relevanceKeywords);
            }
            spinner.succeed(chalk.green(`Successfully scored all ${issues.length} issues`));
            return sortedIssues;
        }
        catch (error) {
            spinner.fail(chalk.red(`Error scoring issues`));
            if (error instanceof Error) {
                throw new Error(`Failed to score issues: ${error.message}`);
            }
            throw new Error(`Failed to score issues: ${String(error)}`);
        }
    }
}
