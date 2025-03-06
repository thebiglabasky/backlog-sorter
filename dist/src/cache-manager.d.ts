import { IssueConnection } from '@linear/sdk';
interface CacheMetadata {
    lastUpdated: string;
    teamId: string;
    backlogStateId: string;
    issueCount: number;
}
interface ScoringCacheMetadata {
    lastUpdated: string;
    teamId: string;
    backlogStateId: string;
    issueCount: number;
    relevanceKeywords: string[];
}
/**
 * Cache issues from the Linear API
 */
export declare function cacheIssues(issues: IssueConnection, teamId: string, backlogStateId: string): Promise<void>;
/**
 * Checks if the cache exists and is valid
 * @param teamId The team ID to validate against
 * @param backlogStateId The backlog state ID to validate against
 * @param cacheTtlHours How many hours to consider the cache valid (default: 24)
 * @returns True if the cache exists and is valid, false otherwise
 */
export declare function isCacheValid(teamId: string, backlogStateId: string, cacheTtlHours?: number): Promise<boolean>;
/**
 * Gets the cache metadata
 * @returns The cache metadata or null if not available
 */
export declare function getCacheMetadata(): Promise<CacheMetadata | null>;
/**
 * Loads issues from the cache
 * @returns The cached issues or null if not available
 */
export declare function loadCachedIssues(): Promise<any[] | null>;
/**
 * Clears all caches
 */
export declare function clearCache(): Promise<void>;
/**
 * Clears only the issues cache
 */
export declare function clearIssuesCache(): Promise<void>;
/**
 * Clears only the scoring cache
 */
export declare function clearScoringCache(): Promise<void>;
/**
 * Saves scored issues to the cache
 * @param scoredIssues The scored issues to cache
 * @param teamId The team ID
 * @param backlogStateId The backlog state ID
 * @param relevanceKeywords The relevance keywords used for scoring
 */
export declare function cacheScoredIssues(scoredIssues: any[], teamId: string, backlogStateId: string, relevanceKeywords: string[]): Promise<void>;
/**
 * Checks if the scoring cache exists and is valid
 * @param teamId The team ID to validate against
 * @param backlogStateId The backlog state ID to validate against
 * @param relevanceKeywords The relevance keywords to validate against
 * @param cacheTtlHours How many hours to consider the cache valid (default: 24)
 * @returns True if the cache exists and is valid, false otherwise
 */
export declare function isScoringCacheValid(teamId: string, backlogStateId: string, relevanceKeywords: string[], cacheTtlHours?: number): Promise<boolean>;
/**
 * Gets the scoring cache metadata
 * @returns The scoring cache metadata or null if not available
 */
export declare function getScoringCacheMetadata(): Promise<ScoringCacheMetadata | null>;
/**
 * Loads cached scored issues from the cache
 * @param ignoreExpiry Optional flag to load the cache even if it's expired (default: false)
 * @returns The cached scored issues or null if not found
 */
export declare function loadCachedScoredIssues(ignoreExpiry?: boolean): Promise<any[] | null>;
export {};
