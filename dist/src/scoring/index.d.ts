import { PrioritizerConfig } from '../config.js';
import { EnrichedIssue } from '../issue-fetcher.js';
import { IssueScore } from '../types.js';
export declare class IssueScorer {
    private config;
    private useCache;
    private forceRefresh;
    constructor(config: PrioritizerConfig, useCache?: boolean, forceRefresh?: boolean);
    /**
     * Score and sort issues
     */
    scoreIssues(issues: EnrichedIssue[]): Promise<IssueScore[]>;
}
