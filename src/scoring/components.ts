import { EMPLOYEE_ALIASES } from '../config.js';
import { EnrichedIssue } from '../issue-fetcher.js';

/**
 * Extract priority label from issue labels
 */
export function extractPriority(issue: EnrichedIssue): string {
  // Get labels from the issue
  const labels = issue.labels || [];

  // Look for priority labels
  for (const label of labels) {
    if (label.name.startsWith('Priority:P1')) return 'P1';
    if (label.name.startsWith('Priority:P2')) return 'P2';
    if (label.name.startsWith('Priority:P3')) return 'P3';
  }

  return 'P3'; // Default to P3 if no priority label found
}

/**
 * Calculate project relevance based on keywords in issue title and description
 */
export function calculateProjectRelevance(issue: EnrichedIssue, relevanceKeywords: string[]): number {
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

  // Get labels from the issue
  const labels = issue.labels || [];

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
export function calculateRecencyScore(date: string | Date | null): number {
  if (!date) return 0;

  const updateDate = new Date(date);
  const now = new Date();
  const daysDifference = (now.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24);

  // Score based on recency - more recent updates get higher scores
  if (daysDifference < 7) return 100; // Updated in the last week
  if (daysDifference < 14) return 80; // Updated in the last two weeks
  if (daysDifference < 30) return 60; // Updated in the last month
  if (daysDifference < 60) return 40; // Updated in the last two months
  if (daysDifference < 90) return 20; // Updated in the last three months
  return 10; // Updated more than three months ago
}

/**
 * Estimate interactions based on comments and other activity
 */
export function estimateInteractions(issue: EnrichedIssue, comments: any): number {
  let interactionScore = 0;

  // Base score on number of comments
  const commentCount = comments?.length || 0;
  interactionScore += Math.min(50, commentCount * 10); // Cap at 50 points from comments

  // Check for external interactions (non-employee comments)
  let externalInteractions = 0;
  let uniqueExternalUsers = new Set();

  if (comments) {
    for (const comment of comments) {
      // Skip null users (automated comments)
      if (!comment.user) continue;

      // Linear API doesn't have 'handle', use email or name for identification
      const userEmail = comment.user.email;
      const userName = comment.user.name;

      // Use email or name as identifier
      const userIdentifier = userEmail || userName;

      // Check if user is an employee (using email)
      const isEmployee = userEmail && EMPLOYEE_ALIASES.includes(userEmail);

      // Skip internal employee comments
      if (isEmployee) continue;

      // Skip automated comments or system users
      if (comment.body.includes('This comment thread is synced') ||
          comment.body.includes('automatically moved') ||
          (userEmail && userEmail.includes('linear.app'))) {
        continue;
      }

      // Count unique external users for higher weighting
      if (userIdentifier) {
        uniqueExternalUsers.add(userIdentifier);
      }

      externalInteractions++;
    }
  }

  // External interactions are weighted more heavily
  interactionScore += Math.min(50, externalInteractions * 15); // Cap at 50 points from external interactions

  // Bonus points for multiple unique external users (indicates broader interest)
  if (uniqueExternalUsers.size > 1) {
    interactionScore += Math.min(20, uniqueExternalUsers.size * 10);
  }

  // Cap the total interaction score at 100
  return Math.min(100, interactionScore);
}

/**
 * Estimate complexity based on issue description, labels, and other factors
 */
export function estimateComplexity(issue: EnrichedIssue): string {
  const description = issue.description || '';
  const title = issue.title || '';

  // Get labels from the issue
  const labels = issue.labels || [];

  // Check for complexity labels
  for (const label of labels) {
    if (label.name.includes('Complexity:Hard')) {
      return 'High';
    }
    if (label.name.includes('Complexity:Low')) {
      return 'Low';
    }
  }

  // Estimate based on description length
  if (description.length > 1000) {
    return 'High';
  } else if (description.length < 200) {
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
