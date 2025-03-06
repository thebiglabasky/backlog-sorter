import { IssueScore, RankingChange } from './types.js';
/**
 * Display ranking changes between two scoring runs
 */
export declare function displayRankingChanges(changes: RankingChange[], maxChangesToShow?: number): void;
/**
 * Display sorted issues with change indicators
 */
export declare function displaySortedIssuesWithChanges(sortedIssues: IssueScore[], changes: RankingChange[], maxToShow?: number): void;
/**
 * Display a single issue with change indicator
 */
export declare function displayIssueWithChange(item: IssueScore, index: number, changeMap: Map<string, RankingChange>): void;
/**
 * Display detailed scoring results
 */
export declare function displayDetailedResults(sortedIssues: IssueScore[]): void;
/**
 * Display statistics about the scoring
 */
export declare function displayStatistics(sortedIssues: IssueScore[]): void;
