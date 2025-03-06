import { calculateProjectRelevance, calculateRecencyScore, estimateComplexity, estimateInteractions, extractPriority } from './components.js';
/**
 * Calculate the final score for an issue based on all scoring components
 */
export async function calculateIssueScore(issue, relevanceKeywords, comments) {
    // Extract priority from issue labels
    const priorityLabel = await extractPriority(issue);
    let priorityScore = 0;
    // Score based on priority label
    if (priorityLabel === 'P1')
        priorityScore = 100;
    else if (priorityLabel === 'P2')
        priorityScore = 70;
    else if (priorityLabel === 'P3')
        priorityScore = 40;
    // Also consider native Linear priority attribute (if available)
    // Linear priority: 1=Urgent, 2=High, 3=Medium, 4=Low, 0=None
    let nativePriorityScore = 0;
    if (issue.priority === 1)
        nativePriorityScore = 100; // Urgent
    else if (issue.priority === 2)
        nativePriorityScore = 70; // High
    else if (issue.priority === 3)
        nativePriorityScore = 40; // Medium
    else if (issue.priority === 4)
        nativePriorityScore = 20; // Low
    // Use the higher of the two priority scores (label-based or native)
    const finalPriorityScore = Math.max(priorityScore, nativePriorityScore);
    // Calculate project relevance (highest priority)
    const projectRelevance = await calculateProjectRelevance(issue, relevanceKeywords);
    // Calculate value components
    const recencyValue = calculateRecencyScore(issue.updatedAt);
    const interactionsValue = estimateInteractions(issue, comments);
    const valueScore = (finalPriorityScore * 0.5) + (recencyValue * 0.3) + (interactionsValue * 0.2);
    // Estimate complexity (prefer simpler issues)
    const complexity = await estimateComplexity(issue);
    let complexityScore = 0;
    if (complexity === 'Low')
        complexityScore = 100;
    else if (complexity === 'Medium')
        complexityScore = 70;
    else if (complexity === 'High')
        complexityScore = 40;
    else
        complexityScore = 70; // Default to medium
    // Final score weighted according to priorities
    // Project relevance (50%) + value (30%) + inverse complexity (20%)
    const finalScore = (projectRelevance * 0.5) + (valueScore * 0.3) + (complexityScore * 0.2);
    return {
        issue,
        projectRelevance,
        valueScore,
        complexityScore,
        finalScore,
        analysisDetails: {
            relevanceKeywords: Math.round(projectRelevance / 10), // Approx keyword count
            priority: priorityLabel,
            nativePriority: issue.priority === 0 ? 'None' : issue.priority === 1 ? 'Urgent' : issue.priority === 2 ? 'High' : issue.priority === 3 ? 'Medium' : 'Low',
            recency: recencyValue,
            interactions: interactionsValue,
            complexity
        }
    };
}
/**
 * Sort issues by their final score in descending order
 */
export function sortIssuesByScore(scoredIssues) {
    return [...scoredIssues].sort((a, b) => b.finalScore - a.finalScore);
}
