import { LinearClient } from '@linear/sdk';
import { IssueScore } from './types.js';
export declare class LinearUpdater {
    private client;
    constructor(client: LinearClient);
    /**
     * Update the order of issues in Linear based on their scores
     */
    updateIssueOrder(sortedIssues: IssueScore[]): Promise<void>;
}
