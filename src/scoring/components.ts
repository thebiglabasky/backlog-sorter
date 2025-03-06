import { EnrichedIssue } from '../issue-fetcher.js';

const HIGH_PRIO = {
  score: 100,
  label: 'High'
}

const MEDIUM_PRIO = {
  score: 70,
  label: 'Medium'
}

const LOW_PRIO = {
  score: 40,
  label: 'Low'
}

/**
 * Computes a priority score
 */
export function calculatePriorityScore(issue: EnrichedIssue): { score: number, label: string } {
  // Use Linear's ones if defined
  if (issue.priority) {
    if (issue.priority <= 2) return HIGH_PRIO;
    if (issue.priority === 3) return MEDIUM_PRIO;
    if (issue.priority === 4) return LOW_PRIO;
  }

  // Look for priority labels if Linear's aren't defined
  for (const label of issue.labels) {
    if (label.name.startsWith('Priority:P1')) return HIGH_PRIO;
    if (label.name.startsWith('Priority:P2')) return MEDIUM_PRIO;
    if (label.name.startsWith('Priority:P3')) return LOW_PRIO;
  }
  return LOW_PRIO; // Default to P3 if no priority label found
}

/**
 * Calculate project relevance based on keywords in issue title and description
 */
export function calculateProjectRelevance(issue: EnrichedIssue, relevanceKeywords: string[], targetProject?: string): number {
  let relevanceScore = 0;
  const title = issue.title.toLowerCase();
  const description = issue.description ? issue.description.toLowerCase() : '';
  const projectName = issue.project?.name?.toLowerCase() || '';
  if (targetProject && projectName == targetProject) {
    return 100;
  }

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
  if (daysDifference < 30) return 100; // Updated in the last month
  if (daysDifference < 90) return 80; // Updated in the last three months
  if (daysDifference < 180) return 50; // Updated in the last six months
  if (daysDifference < 365) return 10; // Updated in the last year
  return 0; // Updated more than one year ago
}

/**
 * Estimate interactions based on comments and other activity
 */
export function estimateInteractions(comments: any): number {
  // Base score on number of comments
  let internalCommentCount = comments?.length || 0;
  // Check for external interactions (non-automated comments)
  let externalInteractions = 0;

  if (comments) {
    for (const comment of comments) {
      // Skip automated comments from Linear GitHub sync
      if (comment.body.includes('This comment thread is synced to a corresponding [GitHub issue]')) {
        continue;
      }

      // Skip other automated comments or system users
      if (comment.body.includes('automatically moved') ||
          (comment.user && comment.user.email && comment.user.email.includes('linear.app'))) {
        continue;
      }

      // Skip internal users (who have a Linear account)
      if (!comment.user) {
        externalInteractions++;
      } else {
        internalCommentCount++;
      }
    }
  }

  // Cap the total interaction score at 100
  return Math.min(100, internalCommentCount * 5 + externalInteractions * 20);
}

const EASY_COMPLEXITY = {
  score: 100,
  label: 'Easy'
}

const MEDIUM_COMPLEXITY = {
  score: 40,
  label: 'Medium'
}

const HARD_COMPLEXITY = {
  score: 5,
  label: 'Hard'
}

/**
 * Estimate complexity based on issue description, labels, and other factors.
 * We bias hard towards easy issues.
 */
export function estimateComplexity(issue: EnrichedIssue): { score: number, label: string } {
  if (issue.estimate) {
    if (issue.estimate < 3) {
      return EASY_COMPLEXITY;
    }
    if (issue.estimate == 4) {
      return MEDIUM_COMPLEXITY;
    }
    if (issue.estimate > 4) {
      return HARD_COMPLEXITY;
    }
  }

  // Check for complexity labels
  for (const label of issue.labels) {
    if (label.name.includes('Difficulty:Hard')) {
      return HARD_COMPLEXITY;
    }
    if (label.name.includes('Difficulty:Medium')) {
      return MEDIUM_COMPLEXITY;
    }
    if (label.name.includes('Difficulty:Easy')) {
      return EASY_COMPLEXITY;
    }
  }
  // Default to medium complexity
  return MEDIUM_COMPLEXITY;
}
