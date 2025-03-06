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
/**
 * Ensures the cache directory exists
 */
async function ensureCacheDir() {
    await fs.ensureDir(CACHE_DIR);
}
/**
 * Safely get a property from an object
 * @param obj The object to get the property from
 * @param prop The property to get
 * @returns The property value or undefined
 */
function safeGet(obj, prop) {
    if (!obj)
        return undefined;
    return obj[prop];
}
/**
 * Safely await a promise or return the value directly
 * @param value The value to await if it's a promise
 * @returns The resolved value
 */
async function safeAwait(value) {
    if (value instanceof Promise) {
        return await value;
    }
    return value;
}
/**
 * Cache issues from the Linear API
 */
export async function cacheIssues(issues, teamId, backlogStateId) {
    const spinner = ora({
        text: chalk.blue('Caching issues...'),
        color: 'blue'
    }).start();
    try {
        await ensureCacheDir();
        // Prepare issues for caching
        const issuesToCache = await Promise.all(issues.nodes.map(async (issue) => {
            // Get labels and comments data safely
            const labelsConnection = await issue.labels();
            const commentsConnection = await issue.comments();
            const labels = labelsConnection.nodes || [];
            const comments = commentsConnection.nodes || [];
            return {
                id: issue.id,
                identifier: issue.identifier,
                title: issue.title,
                description: issue.description,
                priority: issue.priority,
                createdAt: issue.createdAt,
                updatedAt: issue.updatedAt,
                labels: labels.map((label) => ({
                    id: label.id,
                    name: label.name
                })),
                comments: comments.map((comment) => ({
                    id: comment.id,
                    body: comment.body,
                    user: comment.user ? {
                        id: comment.user.id,
                        name: comment.user.name,
                        handle: comment.user.handle
                    } : null
                }))
            };
        }));
        // Save the serialized issues
        await fs.writeJson(ISSUES_CACHE_FILE, issuesToCache, { spaces: 2 });
        // Save metadata
        const metadata = {
            lastUpdated: new Date().toISOString(),
            teamId,
            backlogStateId,
            issueCount: issues.nodes.length
        };
        await fs.writeJson(CACHE_METADATA_FILE, metadata, { spaces: 2 });
        spinner.succeed(chalk.green(`Successfully cached ${issues.nodes.length} issues`));
    }
    catch (error) {
        spinner.fail(chalk.red('Failed to cache issues'));
        console.error(chalk.red('Error details:'));
        if (error instanceof Error) {
            console.error(chalk.red(`  - ${error.message}`));
        }
        else {
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
export async function isCacheValid(teamId, backlogStateId, cacheTtlHours = 24) {
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
        const metadata = await fs.readJson(CACHE_METADATA_FILE);
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
    }
    catch (error) {
        console.error(chalk.yellow('Error checking cache validity:'), error);
        return false;
    }
}
/**
 * Gets the cache metadata
 * @returns The cache metadata or null if not available
 */
export async function getCacheMetadata() {
    try {
        if (await fs.pathExists(CACHE_METADATA_FILE)) {
            return await fs.readJson(CACHE_METADATA_FILE);
        }
        return null;
    }
    catch (error) {
        console.error(chalk.yellow('Error reading cache metadata:'), error);
        return null;
    }
}
/**
 * Loads issues from the cache
 * @returns The cached issues or null if not available
 */
export async function loadCachedIssues() {
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
    }
    catch (error) {
        spinner.fail(chalk.red('Failed to load issues from cache'));
        console.error(chalk.red('Error details:'));
        if (error instanceof Error) {
            console.error(chalk.red(`  - ${error.message}`));
        }
        else {
            console.error(chalk.red(`  - ${String(error)}`));
        }
        return null;
    }
}
/**
 * Clears all caches
 */
export async function clearCache() {
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
    }
    catch (error) {
        spinner.fail(`Failed to clear caches: ${error}`);
        throw error;
    }
}
/**
 * Clears only the issues cache
 */
export async function clearIssuesCache() {
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
    }
    catch (error) {
        spinner.fail(`Failed to clear issues cache: ${error}`);
        throw error;
    }
}
/**
 * Clears only the scoring cache
 */
export async function clearScoringCache() {
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
    }
    catch (error) {
        spinner.fail(chalk.red('Failed to clear scoring cache'));
        console.error(chalk.red('Error details:'));
        if (error instanceof Error) {
            console.error(chalk.red(`  - ${error.message}`));
        }
        else {
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
export async function cacheScoredIssues(scoredIssues, teamId, backlogStateId, relevanceKeywords) {
    const spinner = ora({
        text: chalk.blue('Saving scored issues to cache...'),
        color: 'blue'
    }).start();
    try {
        await ensureCacheDir();
        // Save the serialized scored issues
        await fs.writeJson(SCORING_CACHE_FILE, scoredIssues, { spaces: 2 });
        // Save metadata
        const metadata = {
            lastUpdated: new Date().toISOString(),
            teamId,
            backlogStateId,
            issueCount: scoredIssues.length,
            relevanceKeywords
        };
        await fs.writeJson(SCORING_METADATA_FILE, metadata, { spaces: 2 });
        spinner.succeed(chalk.green(`Successfully cached ${scoredIssues.length} scored issues`));
    }
    catch (error) {
        spinner.fail(chalk.red('Failed to cache scored issues'));
        console.error(chalk.red('Error details:'));
        if (error instanceof Error) {
            console.error(chalk.red(`  - ${error.message}`));
        }
        else {
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
export async function isScoringCacheValid(teamId, backlogStateId, relevanceKeywords, cacheTtlHours = 24) {
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
        const metadata = await fs.readJson(SCORING_METADATA_FILE);
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
    }
    catch (error) {
        console.error(chalk.yellow('Error checking scoring cache validity:'), error);
        return false;
    }
}
/**
 * Gets the scoring cache metadata
 * @returns The scoring cache metadata or null if not available
 */
export async function getScoringCacheMetadata() {
    try {
        if (await fs.pathExists(SCORING_METADATA_FILE)) {
            return await fs.readJson(SCORING_METADATA_FILE);
        }
        return null;
    }
    catch (error) {
        console.error(chalk.yellow('Error reading scoring cache metadata:'), error);
        return null;
    }
}
/**
 * Loads cached scored issues from the cache
 * @param ignoreExpiry Optional flag to load the cache even if it's expired (default: false)
 * @returns The cached scored issues or null if not found
 */
export async function loadCachedScoredIssues(ignoreExpiry = false) {
    const spinner = ora({
        text: chalk.blue('Loading scored issues from cache...'),
        color: 'blue'
    }).start();
    try {
        // Check if the cache file exists
        if (!await fs.pathExists(SCORING_CACHE_FILE)) {
            spinner.fail(chalk.yellow('No cached scored issues found'));
            return null;
        }
        // Load the cached issues
        const cachedScoredIssues = await fs.readJson(SCORING_CACHE_FILE);
        // If we're ignoring expiry, return the cached issues regardless of validity
        if (ignoreExpiry) {
            spinner.succeed(chalk.green(`Successfully loaded ${cachedScoredIssues.length} scored issues from cache (ignoring expiry)`));
            return cachedScoredIssues;
        }
        // Check if the cache is valid
        const metadata = await getScoringCacheMetadata();
        if (!metadata) {
            spinner.fail(chalk.yellow('No scoring cache metadata found'));
            return null;
        }
        // Get cache TTL from environment variables (default to 24 hours)
        const cacheTtlHours = parseInt(process.env.LINEAR_CACHE_TTL_HOURS || '24', 10);
        // Check if the cache is still valid
        const lastUpdated = new Date(metadata.lastUpdated);
        const now = new Date();
        const cacheAgeHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
        if (cacheAgeHours > cacheTtlHours) {
            spinner.fail(chalk.yellow(`Scoring cache expired (${cacheAgeHours.toFixed(1)} hours old, TTL: ${cacheTtlHours} hours)`));
            return null;
        }
        spinner.succeed(chalk.green(`Successfully loaded ${cachedScoredIssues.length} scored issues from cache`));
        return cachedScoredIssues;
    }
    catch (error) {
        spinner.fail(chalk.red('Failed to load scored issues from cache'));
        console.error(chalk.red('Error details:'));
        if (error instanceof Error) {
            console.error(chalk.red(`  - ${error.message}`));
        }
        else {
            console.error(chalk.red(`  - ${String(error)}`));
        }
        return null;
    }
}
