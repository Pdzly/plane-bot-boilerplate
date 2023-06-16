import { Pagination, PaginationType } from "@discordx/pagination";
import {
  APIEmbedField,
  ApplicationCommandOptionType,
  ButtonInteraction,
  CommandInteraction,
} from "discord.js";
import { EmbedBuilder } from "discord.js";
import {
  ButtonComponent,
  Discord,
  Slash,
  SlashChoice,
  SlashGroup,
  SlashOption,
} from "discordx";
import githubService from "../services/githubService.js";
import webhookServices from "../services/webhookServices.js";
import { Inject } from "typedi";

@Discord()
@SlashGroup({ name: "github", description: "Github related commands" })
@SlashGroup("github")
export class GithubCommands {
  @Inject()
  githubService: githubService;
  @Inject()
  userSubscriptionService: webhookServices;
  @Slash({
    description: "Get details about an Issues from the repo",
    name: "getissue",
  })
  async issue(
    @SlashOption({
      description: "Issue Number",
      name: "number",
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    issueNumber: number,
    @SlashOption({
      description: "Make it non Empheral to show someone something",
      name: "public",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    open: boolean | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({
      ephemeral: !open,
    });
    const issue = await this.githubService.getIssue({
      issue_number: issueNumber,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!issue) {
      interaction.editReply("No issue found");
      return;
    }
    const fields: APIEmbedField[] = [];
    fields.push(
      { name: "State", value: issue.data.state, inline: true },
      {
        name: "Labels",
        value:
          issue.data.labels
            .map((label) => (typeof label === "string" ? label : label.name))
            .join(",\n ") || "No labels",
        inline: true,
      }
    );
    if (issue.data.assignees) {
      fields.push({
        name: "Assignees",
        value:
          issue.data.assignees
            ?.map((assignee) =>
              typeof assignee === "string" ? assignee : assignee.login
            )
            .join(",\n ") || "No assignees",
        inline: true,
      });
    }
    let body = githubService.cleanseIssueBody(issue.data.body);
    fields.push({
      name: "Description",
      value:
        (body &&
          (body.length > 1024 ? body.substring(0, 1020) + "..." : body)) ||
        "No description available",
    });
    fields.push({
      name: "Comments",
      value: `${issue.data.comments} comments`,
      inline: true,
    });
    const embed = new EmbedBuilder()
      .setTitle(issue.data.title)
      .setURL(issue.data.html_url)
      .setAuthor(githubService.getAuthor(issue.data.user))
      .addFields(fields)
      .setFooter({ text: `Issue #${issue.data.number}` })
      .setTimestamp();
    interaction.editReply({
      embeds: [embed],
    });
  }

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
    @SlashOption({
      description: "Make it non Empheral to show someone something",
      name: "public",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    open: boolean | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({
      ephemeral: !open,
    });

    try {
      const issues = await this.githubService.getIssues({
        state: state || "open",
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

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
          const issue = issues.data[i + j];
          if (!issue) break;
          let body = githubService.cleanseIssueBody(issue.body);

          if (body) {
            body =
              body.substring(0, 500) + ((body.length > 500 && "...") || "");
          } else {
            body = "No description available";
          }
          embeds.push(
            new EmbedBuilder()
              .setTitle(issue.title)
              .setURL(issue.html_url)
              .setAuthor(githubService.getAuthor(issue.user))
              .addFields({
                name: "Short Description",
                value: body,
              })
              .setFooter({ text: `Issue #${issue.number} | ${issue.state}` })
          );
        }
        pages.push({ embeds: embeds });
      }

      const pagination = new Pagination(interaction, pages, {
        type: PaginationType.Button,
        time: 120000,
        ephemeral: !open,
      });
      await pagination.send();
    } catch (exception) {
      console.error(exception);
      interaction.editReply("Something went wrong!");
    }
  }

  @Slash({
    description: "Get details about one Pull Request from the repo",
    name: "getpullrequest",
  })
  async pr(
    @SlashOption({
      description: "PR Number",
      name: "number",
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    pullRequestNumber: number,
    @SlashOption({
      description: "Make it non Empheral to show someone something",
      name: "public",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    open: boolean | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({
      ephemeral: !open,
    });

    const pull = await this.githubService.getPullRequest({
      owner: "makeplane",
      repo: "plane",
      pull_number: pullRequestNumber,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!pull) {
      interaction.editReply("No issue found");
      return;
    }
    const fields: APIEmbedField[] = [];
    fields.push(
      { name: "State", value: pull.data.state, inline: true },
      {
        name: "Labels",
        value:
          pull.data.labels
            .map((label) => (typeof label === "string" ? label : label.name))
            .join(",\n ") || "No labels",
        inline: true,
      }
    );
    if (pull.data.assignees) {
      fields.push({
        name: "Assignees",
        value:
          pull.data.assignees
            ?.map((assignee) =>
              typeof assignee === "string" ? assignee : assignee.login
            )
            .join(",\n ") || "No assignees",
        inline: true,
      });
    }
    fields.push({
      name: "Description",
      value:
        (pull.data.body &&
          (pull.data.body.length > 1024
            ? pull.data.body.substring(0, 1020) + "..."
            : pull.data.body)) ||
        "No description available",
    });
    fields.push({
      name: "Changes",
      value: `🟢-${pull.data.additions}\n🟠-${pull.data.changed_files}\n🔴-${pull.data.deletions}`,
      inline: true,
    });
    fields.push({
      name: "Comments",
      value: `${pull.data.comments} comments`,
      inline: true,
    });
    const embed = new EmbedBuilder()
      .setTitle(pull.data.title)
      .setURL(pull.data.html_url)
      .setAuthor(githubService.getAuthor(pull.data.user))
      .addFields(fields)
      .setFooter({ text: `PR #${pull.data.number}` })
      .setTimestamp();
    interaction.editReply({
      embeds: [embed],
    });
  }

  @Slash({
    description: "Get all or filtered Pull Request from the repo",
    name: "pullrequest",
  })
  async pullrequests(
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
    @SlashOption({
      description: "Make it non Empheral to show someone something",
      name: "public",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    open: boolean | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    try {
      const pulls = await this.githubService.getPullRequests({
        state: state || "open",
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      if (!pulls) {
        interaction.editReply("No Pull Requests found");
        return;
      }
      if (filter) {
        pulls.data = pulls.data.filter((prs) =>
          prs.title.toLowerCase().includes(filter.toLowerCase())
        );
      }

      const pages = [];
      for (let i = 0; i < pulls.data.length / 5; i++) {
        const embeds: EmbedBuilder[] = [];
        for (let j = 0; j < 5; j++) {
          const pull = pulls.data[i * 5 + j];
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
              .setAuthor(githubService.getAuthor(pull.user))
              .addFields({
                name: "Short Description",
                value: body,
              })
              .setFooter({ text: `PR #${pull.number} | ${pull.state}` })
          );
        }
        pages.push({ embeds: embeds });
      }

      const pagination = new Pagination(interaction, pages, {
        type: PaginationType.Button,
        time: 120000,
        ephemeral: !open,
      });
      await pagination.send();
    } catch (exception) {
      console.error(exception);
      interaction.editReply("Something went wrong!");
    }
  }

  @Slash({
    description:
      "You can get notified when the given issue or pull request is updated or commented",
    name: "subscribe",
  })
  async subscribe(
    @SlashOption({
      description: "The Issue or Pull Request Number",
      name: "id",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    id: number,
    @SlashOption({
      description: "Unsubscribe when the issue or pull request is closed",
      name: "unsubonclose",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    unsubOnClose: boolean | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const subscription = await this.userSubscriptionService.getUserSubscription(
      interaction.user.id,
      id
    );
    if (!subscription) {
      await this.userSubscriptionService.addUserSubscription(
        interaction.user.id,
        id,
        {deleteOnClose: unsubOnClose}
      );
      interaction.editReply(
        "Successfully subscribed to the issue/pull request #" + id
      );
    } else {
      interaction.editReply(
        "You are already subscribed to the issue/pull request #" + id
      );
    }
  }

  @Slash({
    description:
      "If you dont want to get updated about the given issue or pull request",
    name: "unsubscribe",
  })
  async unsubscribe(
    @SlashOption({
      description: "The Issue or Pull Request Number",
      name: "id",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    id: number,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const subscription = await this.userSubscriptionService.getUserSubscription(
      interaction.user.id,
      id
    );
    if (!subscription) {
      await this.userSubscriptionService.unsubscribeUser(
        interaction.user.id,
        id
      );
      interaction.editReply(
        "Successfully unsubscribed to the issue/pull request #" + id
      );
    } else {
      interaction.editReply(
        "You are already unsubscribed to the issue/pull request #" + id
      );
    }
  }

  @ButtonComponent({
    id: /unsubscribe-(\d+)/,
  })
  async unsubscribeButton(interaction: ButtonInteraction) {
    var data = interaction.customId.split("-");
    if (!data[1]) {
      await interaction.deferUpdate();
      return;
    }
    var issueId = Number(data[1]);

    await interaction.deferReply({ ephemeral: true });
    if (
      await this.userSubscriptionService.getUserSubscription(
        interaction.user.id,
        issueId
      )
    ) {
      await this.userSubscriptionService.unsubscribeUser(
        interaction.user.id,
        issueId
      );
      interaction.editReply(
        "Successfully unsubscribed to the issue/pull request #" + issueId
      );
    } else {
      interaction.editReply(
        "You wasnt subscribed to the issue/pull request #" + issueId
      );
    }

    interaction.message.edit({ components: [] });
  }
}
