# Linear Backlog Prioritizer

A tool to automatically prioritize and sort your Linear backlog based on various factors including relevance, value, and complexity.

## Features

- Automatically scores and ranks backlog issues
- Updates issue order in Linear
- Caches results to avoid unnecessary API calls
- Compares scoring changes between runs
- Detailed statistics and analysis

## Installation

1. Clone this repository
2. Install dependencies: `npm install` or `pnpm install`
3. Create a `.env` file with your Linear API key and other configuration (see below)
4. Run the tool: `npm start`

## Configuration

Create a `.env` file with the following variables:

```
LINEAR_API_KEY=lin_api_xxxxxxxxxxxx
LINEAR_TEAM_ID=team_xxxxxxxx
LINEAR_BACKLOG_STATE_ID=state_xxxxxxxx
LINEAR_TARGET_INITIATIVE=Q3 Goals
LINEAR_TARGET_PROJECT=Performance Improvements
LINEAR_RELEVANCE_KEYWORDS=performance,speed,optimization,latency
LINEAR_CACHE_TTL_HOURS=48
LINEAR_EMPLOYEE_GITHUB_ALIASES=user1,user2,user3
```

To find your team ID and backlog state ID, run:

```
npm run find-ids
```

## Usage

```
npm start                   # Score issues without updating Linear
npm run update              # Score issues and update order in Linear
npm run refresh             # Force refresh from API
npm run score-only          # Recompute scores using the issues cache
npm run compare-scores      # Compare new scores with previous scoring results
npm run show-scores         # Show cached scores without recomputing
npm run stats               # Show detailed statistics
npm run options             # Show all available options
```

## Project Structure

The project is organized into the following modules:

- `src/config.ts` - Configuration parsing
- `src/cli.ts` - Command invocation management
- `src/issue-fetcher.ts` - Issues fetching including caching
- `src/scoring/index.ts` - Main scoring module
- `src/scoring/components.ts` - Individual scoring components
- `src/scoring/calculator.ts` - Overall score computation
- `src/diff.ts` - Diffing algorithm
- `src/presentation.ts` - Results presentation
- `src/linear-updater.ts` - Updating Linear's sortOrder
- `src/index.ts` - Main entry point

## Scoring Factors

Issues are scored based on:

1. **Project Relevance (50%)** - How relevant the issue is to your project based on keywords
2. **Value Score (30%)** - Combination of priority, recency, and interactions
3. **Complexity Score (20%)** - Estimated complexity (simpler issues score higher)

## License

ISC
