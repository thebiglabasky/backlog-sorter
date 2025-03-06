import chalk from 'chalk';
import { createChangeMap } from './diff.js';
import { IssueScore, RankingChange } from './types.js';

/**
 * Display ranking changes between two scoring runs
 */
export function displayRankingChanges(changes: RankingChange[], maxChangesToShow: number = 10): void {
  if (changes.length === 0) {
    console.log(chalk.yellow("\nNo ranking changes detected."));
    return;
  }

  console.log(chalk.yellow(`\nMost Significant Ranking Changes (${Math.min(changes.length, maxChangesToShow)} of ${changes.length}):`));

  // Show only the top changes
  const changesToShow = changes.slice(0, maxChangesToShow);

  changesToShow.forEach(change => {
    const changeText = change.change > 0
      ? chalk.green(`↑ Moved up ${change.change} positions`)
      : chalk.red(`↓ Moved down ${Math.abs(change.change)} positions`);

    console.log(`${chalk.cyan(change.identifier)} ${change.title.substring(0, 50)}${change.title.length > 50 ? '...' : ''}`);
    console.log(`  ${changeText} (from #${change.oldRank} to #${change.newRank})`);
  });
}

/**
 * Display sorted issues with change indicators
 */
export function displaySortedIssuesWithChanges(
  sortedIssues: IssueScore[],
  changes: RankingChange[],
  maxToShow: number = 20
): void {
  console.log(chalk.yellow(`\nSorted Issues (showing ${Math.min(sortedIssues.length, maxToShow)} of ${sortedIssues.length}):`));

  // Create a map for quick lookup of changes
  const changeMap = createChangeMap(changes);

  // Show only the top issues
  const issuesToShow = sortedIssues.slice(0, maxToShow);

  issuesToShow.forEach((item, index) => {
    displayIssueWithChange(item, index, changeMap);
  });
}

/**
 * Display a single issue with change indicator
 */
export function displayIssueWithChange(
  item: IssueScore,
  index: number,
  changeMap: Map<string, RankingChange>
): void {
  const change = changeMap.get(item.issue.id);
  let changeIndicator = '';

  if (change) {
    if (change.change > 0) {
      // Moved up
      changeIndicator = chalk.green(`↑${change.change}`);
    } else {
      // Moved down
      changeIndicator = chalk.red(`↓${Math.abs(change.change)}`);
    }
  }

  console.log(
    `${chalk.cyan(`${index + 1}.`)} [${chalk.bold(item.issue.identifier)}] ${item.issue.title} - Score: ${chalk.green(item.finalScore.toFixed(1))} ${changeIndicator}`
  );
}

/**
 * Display detailed scoring results
 */
export function displayDetailedResults(sortedIssues: IssueScore[]): void {
  console.log(chalk.yellow("\nDetailed scoring results:"));
  sortedIssues.forEach((item: IssueScore, index: number) => {
    console.log(chalk.cyan(`\n${index + 1}. [${item.issue.identifier}] ${item.issue.title}`));
    console.log(chalk.gray(`   - Final Score: ${item.finalScore.toFixed(1)}`));
    console.log(chalk.gray(`   - Project Relevance: ${item.projectRelevance.toFixed(1)}`));
    console.log(chalk.gray(`   - Value Score: ${item.valueScore.toFixed(1)}`));
    console.log(chalk.gray(`   - Complexity Score: ${item.complexityScore.toFixed(1)}`));
    console.log(chalk.gray(`   - Analysis Details:`));
    console.log(chalk.gray(`     - Relevance Keywords: ${item.analysisDetails.relevanceKeywords}`));
    console.log(chalk.gray(`     - Priority: ${item.analysisDetails.priority}`));
    console.log(chalk.gray(`     - Native Priority: ${item.analysisDetails.nativePriority}`));
    console.log(chalk.gray(`     - Recency: ${item.analysisDetails.recency.toFixed(1)}`));
    console.log(chalk.gray(`     - Interactions: ${item.analysisDetails.interactions}`));
    console.log(chalk.gray(`     - Complexity: ${item.analysisDetails.complexity}`));
  });
}

/**
 * Display statistics about the scoring
 */
export function displayStatistics(sortedIssues: IssueScore[]): void {
  // Calculate average scores
  const avgFinalScore = sortedIssues.reduce((sum: number, item: IssueScore) => sum + item.finalScore, 0) / sortedIssues.length;
  const avgRelevance = sortedIssues.reduce((sum: number, item: IssueScore) => sum + item.projectRelevance, 0) / sortedIssues.length;
  const avgValueScore = sortedIssues.reduce((sum: number, item: IssueScore) => sum + item.valueScore, 0) / sortedIssues.length;
  const avgComplexityScore = sortedIssues.reduce((sum: number, item: IssueScore) => sum + item.complexityScore, 0) / sortedIssues.length;

  // Count priorities
  const priorities = sortedIssues.reduce((counts, item) => {
    const priority = item.analysisDetails.priority;
    counts[priority] = (counts[priority] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  // Count complexities
  const complexities = sortedIssues.reduce((counts, item) => {
    const complexity = item.analysisDetails.complexity;
    counts[complexity] = (counts[complexity] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  console.log(chalk.yellow("\nScoring Statistics:"));
  console.log(chalk.gray(`  - Total Issues: ${sortedIssues.length}`));
  console.log(chalk.gray(`  - Average Final Score: ${avgFinalScore.toFixed(1)}`));
  console.log(chalk.gray(`  - Average Relevance: ${avgRelevance.toFixed(1)}`));
  console.log(chalk.gray(`  - Average Value Score: ${avgValueScore.toFixed(1)}`));
  console.log(chalk.gray(`  - Average Complexity Score: ${avgComplexityScore.toFixed(1)}`));

  console.log(chalk.gray(`  - Priority Distribution:`));
  Object.entries(priorities).sort().forEach(([priority, count]) => {
    console.log(chalk.gray(`    - ${priority}: ${count} issues (${(count / sortedIssues.length * 100).toFixed(1)}%)`));
  });

  console.log(chalk.gray(`  - Complexity Distribution:`));
  Object.entries(complexities).sort().forEach(([complexity, count]) => {
    console.log(chalk.gray(`    - ${complexity}: ${count} issues (${(count / sortedIssues.length * 100).toFixed(1)}%)`));
  });

  // Show score ranges
  const minScore = Math.min(...sortedIssues.map(item => item.finalScore));
  const maxScore = Math.max(...sortedIssues.map(item => item.finalScore));
  console.log(chalk.gray(`  - Score Range: ${minScore.toFixed(1)} - ${maxScore.toFixed(1)}`));
}
