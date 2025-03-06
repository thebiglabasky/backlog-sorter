import { LinearClient } from "@linear/sdk";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Main function to display Linear team and workflow information
async function displayLinearInfo() {
  // Get API key from environment variables
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("LINEAR_API_KEY environment variable is not set");
    process.exit(1);
  }

  // Initialize Linear client
  const client = new LinearClient({ apiKey });

  try {
    // Get organization info
    const organization = await client.organization;
    console.log(`\nOrganization: ${organization.name}`);

    // Get teams
    const teams = await client.teams();
    console.log("\n=== TEAMS ===");

    for (const team of teams.nodes) {
      console.log(`\nTeam: ${team.name}`);
      console.log(`Team ID: ${team.id}`);

      // Get workflow states for each team
      const states = await team.states();
      console.log("\nWorkflow States:");

      for (const state of states.nodes) {
        console.log(`  - ${state.name} (${state.id})`);
      }

      // Get initiatives (if any)
      try {
        // Fetch all roadmaps without filtering by team
        // The Linear SDK v38 doesn't support filtering roadmaps by team directly
        const roadmaps = await client.roadmaps();

        if (roadmaps.nodes.length > 0) {
          console.log("\nInitiatives/Roadmaps:");
          for (const roadmap of roadmaps.nodes) {
            console.log(`  - ${roadmap.name} (${roadmap.id})`);
          }
        }
      } catch (error) {
        // Roadmaps might not be available
        console.log("\nNo initiatives/roadmaps found or not accessible");
      }

      // Get projects for the team
      // In Linear SDK v38, we need to use the team's projects method directly
      const projects = await team.projects();

      if (projects.nodes.length > 0) {
        console.log("\nProjects:");
        for (const project of projects.nodes) {
          console.log(`  - ${project.name} (${project.id})`);
        }
      } else {
        console.log("\nNo projects found");
      }

      console.log("\n" + "-".repeat(50));
    }

    // Get labels that might be useful for prioritization
    const labels = await client.issueLabels();

    // Filter for priority labels
    const priorityLabels = labels.nodes.filter(label =>
      label.name.toLowerCase().includes('priority') ||
      label.name.toLowerCase().includes('p0') ||
      label.name.toLowerCase().includes('p1') ||
      label.name.toLowerCase().includes('p2') ||
      label.name.toLowerCase().includes('p3')
    );

    if (priorityLabels.length > 0) {
      console.log("\n=== PRIORITY LABELS ===");
      for (const label of priorityLabels) {
        console.log(`  - ${label.name} (${label.id})`);
      }
    }

  } catch (error) {
    console.error("Error fetching Linear information:", error);
  }
}

// Run the main function
if (require.main === module) {
  displayLinearInfo().catch(console.error);
}
