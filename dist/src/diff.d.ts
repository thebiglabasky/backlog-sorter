import { RankingChange } from './types.js';
/**
 * Compare previous and current scoring to identify ranking changes
 */
export declare function compareScoring(previousScoredIssues: any[], currentScoredIssues: any[]): RankingChange[];
/**
 * Create a map of issue IDs to ranking changes for quick lookup
 */
export declare function createChangeMap(changes: RankingChange[]): Map<string, RankingChange>;
