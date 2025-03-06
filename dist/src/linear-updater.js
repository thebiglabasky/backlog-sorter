import chalk from 'chalk';
import ora from 'ora';
export class LinearUpdater {
    constructor(client) {
        this.client = client;
    }
    /**
     * Update the order of issues in Linear based on their scores
     */
    async updateIssueOrder(sortedIssues) {
        const spinner = ora({
            text: chalk.blue('Updating issue order in Linear...'),
            color: 'blue'
        }).start();
        try {
            let progress = 0;
            const total = sortedIssues.length;
            // Linear uses sortOrder for manual ordering of issues
            // Lower sortOrder values appear higher in the list
            for (let i = 0; i < sortedIssues.length; i++) {
                const issue = sortedIssues[i].issue;
                // Use a large enough step between values to allow for future insertions
                const sortOrder = (i + 1) * 100;
                spinner.text = chalk.blue(`Updating issues (${progress}/${total}): Setting ${issue.identifier} sort order to ${sortOrder}`);
                // Use the Linear client's updateIssue method to update the issue sort order
                await this.client.updateIssue(issue.id, { sortOrder });
                progress++;
            }
            spinner.succeed(chalk.green(`Successfully updated ${total} issue sort orders in Linear!`));
        }
        catch (error) {
            spinner.fail(chalk.red('Error updating issue order'));
            console.error(chalk.red('Detailed error information:'));
            if (error instanceof Error) {
                console.error(chalk.red(`  - Message: ${error.message}`));
                console.error(chalk.red(`  - Stack: ${error.stack}`));
            }
            else {
                console.error(chalk.red(`  - Unknown error: ${error}`));
            }
            throw error;
        }
    }
}
