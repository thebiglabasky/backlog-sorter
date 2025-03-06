import { PrioritizerConfig } from '../config.js';
import { EnrichedIssue } from '../issue-fetcher.js';
import { IssueScore } from '../types.js';
import {
  calculateProjectRelevance,
  calculateRecencyScore,
  estimateComplexity as computeComplexity,
  calculatePriorityScore as computePriority,
  estimateInteractions
} from './components.js';

/**
 * Calculate the final score for an issue based on all scoring components
 */
export function calculateIssueScore(
  issue: EnrichedIssue,
  comments: any,
  config: PrioritizerConfig
): IssueScore {
  // Extract priority from issue labels
  const priority = computePriority(issue);

  // Calculate project relevance (highest priority)
  const projectRelevance = calculateProjectRelevance(issue, config.relevanceKeywords, config.targetProject);

  // Calculate value components
  const recencyValue = calculateRecencyScore(issue.updatedAt || null);
  const interactionsValue = estimateInteractions(comments);
  const valueScore = (priority.score * config.weightPriority) + (recencyValue * config.weightRecency) + (interactionsValue * config.weightInteractions);

  // Estimate complexity (prefer simpler issues)
  const complexity = computeComplexity(issue);

  // Final score weighted according to priorities
  // Project relevance (50%) + value (20%) + inverse complexity (30%)
  const finalScore = (projectRelevance * config.weightRelevance) + (complexity.score * config.weightComplexity) + (valueScore * config.weightValue);

  return {
    issue,
    projectRelevance,
    valueScore,
    complexityScore: complexity.score,
    finalScore,
    analysisDetails: {
      relevanceKeywords: Math.round(projectRelevance / 10), // Approx keyword count
      priority,
      recency: recencyValue,
      interactions: interactionsValue,
      complexity
    }
  };
}

/**
 * Sort issues by their final score in descending order
 */
export function sortIssuesByScore(scoredIssues: IssueScore[]): IssueScore[] {
  return [...scoredIssues].sort((a, b) => b.finalScore - a.finalScore);
}
