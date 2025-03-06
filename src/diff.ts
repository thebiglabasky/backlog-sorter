import { RankingChange } from './types.js';

/**
 * Compare previous and current scoring to identify ranking changes
 */
export function compareScoring(previousScoredIssues: any[], currentScoredIssues: any[]): RankingChange[] {
  const changes: RankingChange[] = [];

  // Create maps for quick lookup
  const previousRankMap = new Map();
  const currentRankMap = new Map();

  // Build maps of issue ID to rank
  previousScoredIssues.forEach((item, index) => {
    previousRankMap.set(item.issue.id, {
      rank: index + 1,
      identifier: item.issue.identifier,
      title: item.issue.title
    });
  });

  currentScoredIssues.forEach((item, index) => {
    currentRankMap.set(item.issue.id, {
      rank: index + 1,
      identifier: item.issue.identifier,
      title: item.issue.title
    });
  });

  // Find issues that exist in both sets and calculate rank changes
  for (const [issueId, currentInfo] of currentRankMap.entries()) {
    if (previousRankMap.has(issueId)) {
      const previousInfo = previousRankMap.get(issueId);
      const rankChange = previousInfo.rank - currentInfo.rank;

      // Only include if there was a change in rank
      if (rankChange !== 0) {
        changes.push({
          issueId,
          identifier: currentInfo.identifier,
          title: currentInfo.title,
          oldRank: previousInfo.rank,
          newRank: currentInfo.rank,
          change: rankChange
        });
      }
    }
  }

  // Sort by absolute change magnitude (largest changes first)
  return changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

/**
 * Create a map of issue IDs to ranking changes for quick lookup
 */
export function createChangeMap(changes: RankingChange[]): Map<string, RankingChange> {
  const changeMap = new Map<string, RankingChange>();
  for (const change of changes) {
    changeMap.set(change.issueId, change);
  }
  return changeMap;
}
