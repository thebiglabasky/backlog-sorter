import { EnrichedIssue } from '../issue-fetcher.js';
/**
 * Extract priority label from issue labels
 */
export declare function extractPriority(issue: EnrichedIssue): string;
/**
 * Calculate project relevance based on keywords in issue title and description
 */
export declare function calculateProjectRelevance(issue: EnrichedIssue, relevanceKeywords: string[]): number;
/**
 * Calculate recency score based on when the issue was last updated
 */
export declare function calculateRecencyScore(date: string | Date | null): number;
/**
 * Estimate interactions based on comments and other activity
 */
export declare function estimateInteractions(issue: EnrichedIssue, comments: any): number;
/**
 * Estimate complexity based on issue description, labels, and other factors
 */
export declare function estimateComplexity(issue: EnrichedIssue): string;
