import { Issue } from '@linear/sdk';
import { IssueScore } from '../types.js';
/**
 * Calculate the final score for an issue based on all scoring components
 */
export declare function calculateIssueScore(issue: Issue, relevanceKeywords: string[], comments: any): Promise<IssueScore>;
/**
 * Sort issues by their final score in descending order
 */
export declare function sortIssuesByScore(scoredIssues: IssueScore[]): IssueScore[];
