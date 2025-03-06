import { LinearClient } from '@linear/sdk';
import { PrioritizerConfig } from './config.js';
export interface EnrichedIssue {
    id: string;
    identifier: string;
    title: string;
    description?: string;
    priority?: number;
    createdAt: string;
    updatedAt: string;
    labels: Array<{
        id: string;
        name: string;
        color?: string;
    }>;
    comments: Array<{
        id: string;
        body: string;
        createdAt?: string;
        user?: {
            id: string;
            name: string;
            email?: string;
            displayName?: string;
            organization?: {
                id: string;
                name: string;
            } | null;
        } | null;
    }>;
}
export declare class IssueFetcher {
    private client;
    private config;
    private useCache;
    private forceRefresh;
    constructor(client: LinearClient, config: PrioritizerConfig, useCache?: boolean, forceRefresh?: boolean);
    /**
     * Fetch backlog issues from Linear API or cache
     */
    fetchIssues(): Promise<EnrichedIssue[]>;
    /**
     * Fetch all backlog issues from Linear for the specified team
     */
    private fetchBacklogIssues;
    /**
     * Fetch comments with detailed user information for an issue
     */
    private fetchCommentsWithUserInfo;
}
