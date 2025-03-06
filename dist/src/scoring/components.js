import { EMPLOYEE_ALIASES } from '../config.js';
/**
 * Extract priority label from issue labels
 */
export async function extractPriority(issue) {
    // Get labels - we need to await the labels fetch and then access nodes
    const labelsConnection = await issue.labels();
    const labels = labelsConnection.nodes || [];
    // Look for priority labels
    for (const label of labels) {
        if (label.name.startsWith('Priority:P1'))
            return 'P1';
        if (label.name.startsWith('Priority:P2'))
            return 'P2';
        if (label.name.startsWith('Priority:P3'))
            return 'P3';
    }
    return 'P3'; // Default to P3 if no priority label found
}
/**
 * Calculate project relevance based on keywords in issue title and description
 */
export async function calculateProjectRelevance(issue, relevanceKeywords) {
    let relevanceScore = 0;
    const title = issue.title.toLowerCase();
    const description = issue.description ? issue.description.toLowerCase() : '';
    // Check for keywords in title and description
    for (const keyword of relevanceKeywords) {
        const keywordLower = keyword.toLowerCase();
        if (title.includes(keywordLower)) {
            // Keywords in title are more important
            relevanceScore += 20;
        }
        if (description.includes(keywordLower)) {
            // Keywords in description are less important
            relevanceScore += 10;
        }
    }
    // Check for relevance in labels
    const labelsConnection = await issue.labels();
    const labels = labelsConnection.nodes || [];
    for (const label of labels) {
        const labelName = label.name.toLowerCase();
        for (const keyword of relevanceKeywords) {
            if (labelName.includes(keyword.toLowerCase())) {
                relevanceScore += 15;
            }
        }
    }
    // Cap the relevance score at 100
    return Math.min(100, relevanceScore);
}
/**
 * Calculate recency score based on when the issue was last updated
 */
export function calculateRecencyScore(date) {
    if (!date)
        return 0;
    const updateDate = new Date(date);
    const now = new Date();
    const daysDifference = (now.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24);
    // Score based on recency - more recent updates get higher scores
    if (daysDifference < 7)
        return 100; // Updated in the last week
    if (daysDifference < 14)
        return 80; // Updated in the last two weeks
    if (daysDifference < 30)
        return 60; // Updated in the last month
    if (daysDifference < 60)
        return 40; // Updated in the last two months
    if (daysDifference < 90)
        return 20; // Updated in the last three months
    return 10; // Updated more than three months ago
}
/**
 * Estimate interactions based on comments and other activity
 */
export function estimateInteractions(issue, comments) {
    let interactionScore = 0;
    // Base score on number of comments
    const commentCount = comments?.nodes?.length || 0;
    interactionScore += Math.min(50, commentCount * 10); // Cap at 50 points from comments
    // Check for external interactions (non-employee comments)
    let externalInteractions = 0;
    if (comments?.nodes) {
        for (const comment of comments.nodes) {
            const userHandle = comment.user?.handle;
            if (userHandle && !EMPLOYEE_ALIASES.includes(userHandle)) {
                externalInteractions++;
            }
        }
    }
    // External interactions are weighted more heavily
    interactionScore += Math.min(50, externalInteractions * 15); // Cap at 50 points from external interactions
    // Cap the total interaction score at 100
    return Math.min(100, interactionScore);
}
/**
 * Estimate complexity based on issue description, labels, and other factors
 */
export async function estimateComplexity(issue) {
    const description = issue.description || '';
    const title = issue.title || '';
    // Get labels
    const labelsConnection = await issue.labels();
    const labels = labelsConnection.nodes || [];
    // Check for complexity labels
    for (const label of labels) {
        if (label.name.includes('Complexity:High') || label.name.includes('Complex')) {
            return 'High';
        }
        if (label.name.includes('Complexity:Low') || label.name.includes('Simple')) {
            return 'Low';
        }
    }
    // Estimate based on description length
    if (description.length > 1000) {
        return 'High';
    }
    else if (description.length < 200) {
        return 'Low';
    }
    // Check for complexity indicators in title and description
    const complexityIndicators = [
        'complex', 'difficult', 'challenging', 'refactor', 'rewrite', 'overhaul',
        'architecture', 'redesign', 'major', 'significant'
    ];
    const simplicityIndicators = [
        'simple', 'easy', 'quick', 'trivial', 'straightforward', 'minor',
        'typo', 'text', 'label', 'wording'
    ];
    const lowerTitle = title.toLowerCase();
    const lowerDescription = description.toLowerCase();
    for (const indicator of complexityIndicators) {
        if (lowerTitle.includes(indicator) || lowerDescription.includes(indicator)) {
            return 'High';
        }
    }
    for (const indicator of simplicityIndicators) {
        if (lowerTitle.includes(indicator) || lowerDescription.includes(indicator)) {
            return 'Low';
        }
    }
    // Default to medium complexity
    return 'Medium';
}
