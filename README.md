# Linear Backlog Prioritizer

A tool to prioritize and sort Linear backlog issues based on various criteria.

## Features

- Prioritizes backlog issues based on relevance, value, and complexity
- Caches API data locally to reduce API calls and improve performance
- Provides detailed scoring and analysis of issues
- Updates issue sort order in Linear to match prioritization

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd backlog-sorter

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env to add your Linear API key and other required values
```

## Environment Variables

Create a `.env` file with the following variables:

```
LINEAR_API_KEY=lin_api_xxxxxxxxxxxx
LINEAR_TEAM_ID=team_xxxxxxxx
LINEAR_BACKLOG_STATE_ID=state_xxxxxxxx
LINEAR_TARGET_INITIATIVE=Q3 Goals  # Optional
LINEAR_TARGET_PROJECT=Performance Improvements  # Optional
LINEAR_RELEVANCE_KEYWORDS=performance,speed,optimization,latency  # Optional
LINEAR_CACHE_TTL_HOURS=24  # Optional, defaults to 24
```

To find the required IDs, you can run:

```bash
pnpm run find-ids
```

## Usage

### Basic Usage

```bash
# Run the prioritizer (scores issues but doesn't update Linear)
pnpm start

# Score issues and update their sort order in Linear
pnpm run update

# Run with debug information
pnpm start -- --debug

# Only score issues without updating Linear
pnpm run score-only
```

### Cache Management

The tool caches data from the Linear API to improve performance and reduce API calls. By default, the cache is valid for 24 hours.

```bash
# Show cache information
pnpm run cache-info

# Force refresh the cache
pnpm run refresh

# Clear all cache
pnpm run clear-cache

# Clear only the scoring cache
pnpm run clear-scoring-cache

# Clear only the issues cache
pnpm run clear-issues-cache
```

### Command Line Options

- `--update`: Update issue sort order in Linear
- `--no-cache`: Don't use cache, fetch directly from API
- `--refresh`: Force refresh the cache
- `--clear-cache`: Clear all cache
- `--clear-scoring-cache`: Clear only the scoring cache
- `--clear-issues-cache`: Clear only the issues cache
- `--cache-info`: Show cache information
- `--debug`: Show debug information
- `--score-only`: Only score issues, don't update Linear
- `--help`: Show help information

## How It Works

1. The tool fetches issues from the Linear API or loads them from cache
2. Each issue is scored based on:
   - Project relevance (matching keywords, initiative, project)
   - Value score (priority, recency, interactions)
   - Complexity score (estimated effort)
3. Issues are sorted by their final score
4. The sorted issues are displayed with their scores
5. When using the `--update` flag, the tool updates the `sortOrder` field of each issue in Linear to match the prioritization

## Scoring Details

Issues are scored based on multiple factors:

- **Project Relevance**: How relevant the issue is to your current priorities
  - Matches with relevance keywords
  - Belongs to target initiative or project

- **Value Score**: The potential value of implementing the issue
  - Priority level in Linear
  - Recency (recently created issues score higher)
  - Interactions (comments, reactions)

- **Complexity Score**: The estimated effort to implement
  - Based on issue description length, comments, and other factors
  - Lower complexity issues score higher for faster wins

## Cache Structure

The cache is stored in the `.cache` directory:

- `issues.json`: Cached issue data
- `scoring.json`: Cached scoring data
- `metadata.json`: Cache metadata (last updated, team ID, etc.)

The cache is automatically refreshed when:
- It's older than the configured TTL (default: 24 hours)
- The team ID or backlog state ID changes
- The `--refresh` flag is used

## Troubleshooting

If you encounter issues:

1. Make sure your Linear API key has sufficient permissions
2. Verify the team ID and backlog state ID are correct
3. Try clearing the cache with `pnpm run clear-cache`
4. Run with `--debug` flag for more detailed logs

## License

[MIT](LICENSE)
