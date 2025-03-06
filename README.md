# Linear Backlog Prioritizer

A tool to automatically prioritize and sort your Linear backlog based on various factors including relevance, value, and complexity.

## Features

- Automatically scores and ranks backlog issues
- Updates issue order in Linear with sequential numbering (1, 2, 3, etc.)
- Fetches up to 200 issues from your backlog
- Caches results to avoid unnecessary API calls
- Compares scoring changes between runs
- Detailed statistics and analysis
- Configurable scoring weights to customize prioritization

## Installation

1. Clone this repository
2. Install dependencies: `npm install` or `pnpm install`
3. Create a `.env` file with your Linear API key and other configuration (see below)
4. Run the tool: `npm start`

## Configuration

Create a `.env` file with the following variables:

```
# Required configuration
LINEAR_API_KEY=lin_api_xxxxxxxxxxxx
LINEAR_TEAM_ID=team_xxxxxxxx
LINEAR_BACKLOG_STATE_ID=state_xxxxxxxx

# Optional configuration
LINEAR_TARGET_PROJECT=Performance Improvements
LINEAR_RELEVANCE_KEYWORDS=performance,speed,optimization,latency
LINEAR_CACHE_TTL_HOURS=48

# Scoring weights (must sum to 1)
WEIGHT_RELEVANCE=0.5
WEIGHT_COMPLEXITY=0.3
WEIGHT_VALUE=0.2

# Value components weights (must sum to 1)
WEIGHT_PRIORITY=0.5
WEIGHT_RECENCY=0.3
WEIGHT_INTERACTIONS=0.2
```

To find your team ID and backlog state ID, run:

```
npm run find-ids
```

See `.env.example` for a complete example configuration with comments.

## Usage

```
npm start                # Score issues without updating Linear (alias for npm run score)
npm run score            # Fetch issues if needed, compute scores, and display results
npm run compare          # Compare new scores with previous scoring results
npm run update-linear    # Update issue order in Linear based on scoring
npm run reset            # Clear all caches
npm run cache-details    # Show detailed information about caches
npm run score-details    # Show detailed information about scores
npm run help             # Show help message with available commands
```

## Issue Ordering

When you run `npm run update-linear`, the tool will:

1. Score and sort all issues in your backlog based on the scoring factors
2. Update the `sortOrder` field in Linear for each issue
3. Set `sortOrder` values sequentially starting from 1 (highest priority) and incrementing by 1 for each issue

This ensures your backlog is ordered with a clean, sequential numbering system that's easy to understand at a glance.

## Project Structure

The project is organized into the following modules:

- `src/config.ts` - Configuration parsing
- `src/cli.ts` - Command invocation management
- `src/issue-fetcher.ts` - Issues fetching including caching (fetches up to 200 issues)
- `src/scoring/index.ts` - Main scoring module
- `src/scoring/components.ts` - Individual scoring components
- `src/scoring/calculator.ts` - Overall score computation
- `src/diff.ts` - Diffing algorithm
- `src/presentation.ts` - Results presentation
- `src/linear-updater.ts` - Updating Linear's sortOrder
- `src/index.ts` - Main entry point

## Scoring Factors

Issues are scored based on three main factors with configurable weights:

1. **Project Relevance (default: 50%)** - How relevant the issue is to your project based on keywords
2. **Complexity Score (default: 30%)** - Estimated complexity (simpler issues score higher)
3. **Value Score (default: 20%)** - Combination of priority, recency, and interactions

The Value Score is further broken down into:
- **Priority (default: 50%)** - Issue priority label
- **Recency (default: 30%)** - How recently the issue was created or updated
- **Interactions (default: 20%)** - Number and type of interactions on the issue

You can adjust all these weights in your `.env` file to customize the scoring algorithm for your team's needs.

## License

ISC
