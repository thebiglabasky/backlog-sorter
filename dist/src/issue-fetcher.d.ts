import { Issue, LinearClient } from '@linear/sdk';
import { PrioritizerConfig } from './config.js';
export declare class IssueFetcher {
    private client;
    private config;
    private useCache;
    private forceRefresh;
    constructor(client: LinearClient, config: PrioritizerConfig, useCache?: boolean, forceRefresh?: boolean);
    /**
     * Fetch backlog issues from Linear API or cache
     */
    fetchIssues(): Promise<Issue[]>;
    /**
     * Fetch all backlog issues from Linear for the specified team
     */
    private fetchBacklogIssues;
}
