import { Issue } from '@linear/sdk';
/**
 * Represents a scored issue with all its scoring components
 */
export interface IssueScore {
    issue: Issue;
    projectRelevance: number;
    valueScore: number;
    complexityScore: number;
    finalScore: number;
    analysisDetails: {
        relevanceKeywords: number;
        priority: string;
        nativePriority: string;
        recency: number;
        interactions: number;
        complexity: string;
    };
}
/**
 * Represents a change in ranking between two scoring runs
 */
export interface RankingChange {
    issueId: string;
    identifier: string;
    title: string;
    oldRank: number;
    newRank: number;
    change: number;
}
