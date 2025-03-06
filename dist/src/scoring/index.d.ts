import { Issue } from '@linear/sdk';
import { PrioritizerConfig } from '../config.js';
import { IssueScore } from '../types.js';
export declare class IssueScorer {
    private config;
    private useCache;
    private forceRefresh;
    constructor(config: PrioritizerConfig, useCache?: boolean, forceRefresh?: boolean);
    /**
     * Score and sort issues
     */
    scoreIssues(issues: Issue[]): Promise<IssueScore[]>;
}
