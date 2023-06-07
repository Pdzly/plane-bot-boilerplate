import { Pagination, PaginationType } from "@discordx/pagination";
import { ApplicationCommandOptionType, CommandInteraction } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx";
import { Octokit, App } from "octokit";

@Discord()
@SlashGroup({ name: "github", description: "Github related commands" })
@SlashGroup("github")
export class GithubCommands {
  octokit: Octokit = new Octokit(
    (process.env.GITHUB_TOKEN && { auth: process.env.GITHUB_TOKEN }) || {}
  );

  @Slash({
    description: "Get all or filtered Issues from the repo",
    name: "issues",
  })
  async issues(
    @SlashChoice("open", "closed", "all")
    @SlashOption({
      description: "State",
      name: "state",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    state: "open" | "closed" | "all" | undefined,
    @SlashOption({
      description: "Filter",
      name: "filter",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    filter: string | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply();
    try{
    const issues = await this.octokit.request(
      "GET /repos/{owner}/{repo}/issues",
      {
        owner: "makeplane",
        repo: "plane",
        state: state || "open",
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!issues) {
      interaction.editReply("No issues found");
      return;
    }

    if (filter) {
      issues.data = issues.data.filter((issue) =>
        issue.title.toLowerCase().includes(filter.toLowerCase())
      );
    }

    const pages = [];
    for (let i = 0; i < issues.data.length / 5; i++) {
      const embeds: EmbedBuilder[] = [];
      for (let j = 0; j < 5; j++) {
        const issue = issues.data[i * 5 + j];
        if (!issue) break;
        let body = issue.body;
        body = body?.replace(
          `### Is there an existing issue for this?

- [X] I have searched the existing issues
`,
          ""
        );
        if (body && body.length > 100) {
          body = body.substring(0, 100) + "...";
        } else {
          body = "No description available";
        }

        embeds.push(
          new EmbedBuilder()
            .setTitle(issue.title)
            .setURL(issue.html_url)
            .setAuthor({
              name: issue.user?.login || "Unknown",
              iconURL: issue.user?.avatar_url,
              url: issue.user?.html_url,
            })
            .addFields({
              name: "Short Description",
              value: body,
            })
        );
        pages.push({ embeds: embeds });

        const pagination = new Pagination(interaction, pages, {
          type: PaginationType.Button,
          time: 120000,
        });
        await pagination.send();
      }
    }
  }catch (exception) {
    console.error(exception);
    interaction.editReply("Something went wrong!");
  }
    
  }
  @Slash({
    description: "Get all or filtered Pull Request from the repo",
    name: "pr",
  })
  async pullrequest(
    @SlashChoice("open", "closed", "all")
    @SlashOption({
      description: "State",
      name: "state",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    state: "open" | "closed" | "all" | undefined,
    @SlashOption({
      description: "Filter",
      name: "filter",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    filter: string | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply();
    try {
      const pulls = await this.octokit.request(
        "GET /repos/{owner}/{repo}/pulls",
        {
          owner: "makeplane",
          repo: "plane",
          state: state || "open",
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      if (!pulls) {
        interaction.editReply("No Pull Requests found");
        return;
      }
      let data = pulls.data
      if (filter) {
        pulls.data = pulls.data.filter((prs) =>
          prs.title.toLowerCase().includes(filter.toLowerCase())
        );
      }

      const pages = [];
      for (let i = 0; i < pulls.data.length / 5; i++) {
        const embeds: EmbedBuilder[] = [];
        for (let j = 0; j < 5; j++) {
          const pull = pulls.data[i * 5 + j]
          if (!pull) break;
          let body = pull.body;
          
          if (body && body.length > 100) {
            body = body.substring(0, 100) + "...";
          } else {
            body = "No description available";
          }

          embeds.push(
            new EmbedBuilder()
              .setTitle(pull.title)
              .setURL(pull.html_url)
              .setAuthor({
                name: pull.user?.login || "Unknown",
                iconURL: pull.user?.avatar_url,
                url: pull.user?.html_url,
              })
              .addFields({
                name: "Short Description",
                value: body,
              })
          );
          pages.push({ embeds: embeds });

          const pagination = new Pagination(interaction, pages, {
            type: PaginationType.Button,
            time: 120000,
          });
          await pagination.send();
        }
      }
    } catch (exception) {
      console.error(exception);
      interaction.editReply("Something went wrong!");
    }
  }
}
