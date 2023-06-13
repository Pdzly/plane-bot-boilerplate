import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import http from "http";
import EventSource from "eventsource";
import {
  ActionRow,
  ActionRowBuilder,
  BaseGuildTextChannel,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ForumChannel,
  ThreadChannel,
} from "discord.js";
import { bot } from "../main.js";
import UserSubscriptionRepository from "../repositories/userSubscriptionRepository.js";
import { Inject, Service } from "typedi";
import UserSubscription from "../models/userSubscription.js";
import githubService from "./githubService.js";

@Service()
export default class webhookServices {
  @Inject()
  userSubscriptionRepository: UserSubscriptionRepository;
  @Inject()
  githubService: githubService;
  webhooks = new Webhooks({
    secret: process.env.WEBHOOK_SECRET || "CHANGE_ME_GODDAMNIT",
  });
  webhookChannel: BaseGuildTextChannel | undefined;
  constructor() {
    bot.guilds.cache.some(async (guild) => {
      const channel = await guild.channels.fetch(
        process.env.WEBHOOK_CHANNEL_ID!
      );
      if (!channel) return;
      this.webhookChannel = channel as BaseGuildTextChannel;
      return true;
    });

    this.webhooks.onAny((event) => {
      console.log(event.name, "event received");
    });

    this.webhooks.on("issues.opened", async (ev) => {
      try {
        const embed = new EmbedBuilder();
        embed.setTitle("New Issue: " + ev.payload.issue.title);
        embed.setURL(ev.payload.issue.html_url);
        embed.setAuthor({
          name: ev.payload.sender.login,
          iconURL: ev.payload.sender.avatar_url,
          url: ev.payload.sender.html_url,
        });
        ev.payload.issue.body =
          ev.payload.issue.body?.replace(
            `### Is there an existing issue for this?
            
            - [X] I have searched the existing issues
            `,
            ""
          ) || null;
        embed.setDescription(
          (ev.payload.issue.body?.length || 0) > 4096
            ? ev.payload.issue.body?.substring(0, 4092) + "..."
            : ev.payload.issue.body
        );
        if (!this.webhookChannel) return;
        let channel = (await this.webhookChannel.threads.fetch()).threads.find(
          (x) => x.name === "Issues" && x.parentId === this.webhookChannel?.id
        ) as ThreadChannel;
        if (!channel) {
          if (this.webhookChannel instanceof ForumChannel) {
            channel = await this.webhookChannel.threads.create({
              name: "Issues",
              message: { content: "Issue Updates will be posted here" },
            });
          } else {
            channel = await this.webhookChannel.threads.create({
              name: "Issues",
            });
          }
        }
        if (channel?.archived && channel.unarchivable) {
          await channel.setArchived(false);
        }
        await channel?.send({ embeds: [embed] });
      } catch (e) {
        console.error(e);
      }
    });

    this.webhooks.on("issues.closed", async (ev) => {
      try {
        try {
          if (ev.payload.issue.pull_request !== undefined) {
            this.getUsersForIssue(ev.payload.issue.number).then((x) =>
              this.handlePullRequestSubscription(x, ev, true)
            );
          } else {
            this.getUsersForIssue(ev.payload.issue.number).then((x) =>
              this.handleIssueSubscription(x, ev, true)
            );
          }
        } catch (e) {
          console.error(e);
        }
        const embed = new EmbedBuilder();
        embed.setTitle("Closed: " + ev.payload.issue.title);
        embed.setURL(ev.payload.issue.html_url);
        embed.setAuthor({
          name: ev.payload.sender.login,
          iconURL: ev.payload.sender.avatar_url,
          url: ev.payload.sender.html_url,
        });

        if (!this.webhookChannel) return;
        let channel = (await this.webhookChannel.threads.fetch()).threads.find(
          (x) => x.name === "Issues" && x.parentId === this.webhookChannel?.id
        ) as ThreadChannel;
        if (!channel) {
          if (this.webhookChannel instanceof ForumChannel) {
            channel = await this.webhookChannel.threads.create({
              name: "Issues",
              message: { content: "Issue Updates will be posted here" },
            });
          } else {
            channel = await this.webhookChannel.threads.create({
              name: "Issues",
            });
          }
        }
        if (channel?.archived && channel.unarchivable) {
          await channel.setArchived(false);
        }
        await channel?.send({ embeds: [embed] });
      } catch (e) {
        console.error(e);
      }
    });

    this.webhooks.on("issue_comment.created", async (ev) => {
      try {
        try {
          if (ev.payload.issue.pull_request !== undefined) {
            this.getUsersForIssue(ev.payload.issue.number).then((x) =>
              this.handlePullRequestSubscription(x, ev)
            );
          } else {
            this.getUsersForIssue(ev.payload.issue.number).then((x) =>
              this.handleIssueSubscription(x, ev)
            );
          }
        } catch (e) {
          console.error(e);
        }
        const embed = new EmbedBuilder();
        embed.setTitle("Comment to " + ev.payload.issue.title);
        embed.setURL(ev.payload.issue.html_url);

        embed.setAuthor({
          name: ev.payload.sender.login,
          iconURL: ev.payload.sender.avatar_url,
          url: ev.payload.sender.html_url,
        });
        embed.setDescription(
          (ev.payload.comment.body?.length || 0) > 4096
            ? ev.payload.comment.body?.substring(0, 4092) + "..."
            : ev.payload.comment.body
        );

        if (!this.webhookChannel) return;
        let channel = (await this.webhookChannel.threads.fetch()).threads.find(
          (x) =>
            x.name ===
              ((ev.payload.issue.pull_request !== undefined &&
                "Pull-Requests") ||
                "Issues") && x.parentId === this.webhookChannel?.id
        ) as ThreadChannel;
        if (!channel) {
          if (ev.payload.issue.pull_request !== undefined) {
            if (this.webhookChannel instanceof ForumChannel) {
              channel = await this.webhookChannel.threads.create({
                name: "Pull-Requests",
                message: {
                  content: "Pull Request Updates will be posted here",
                },
              });
            } else {
              channel = await this.webhookChannel.threads.create({
                name: "Pull-Requests",
              });
            }
          } else {
            if (this.webhookChannel instanceof ForumChannel) {
              channel = await this.webhookChannel.threads.create({
                name: "Issues",
                message: { content: "Issue Updates will be posted here" },
              });
            } else {
              channel = await this.webhookChannel.threads.create({
                name: "Issues",
              });
            }
          }
        }

        if (channel.archived && channel.unarchivable) {
          await channel.setArchived(false);
        }
        await channel.send({ embeds: [embed] });
      } catch (e) {
        console.error(e);
      }
    });

    this.webhooks.on("pull_request.opened", async (ev) => {
      try {
        const embed = new EmbedBuilder();
        embed.setTitle("New Pull Request: " + ev.payload.pull_request.title);
        embed.setURL(ev.payload.pull_request.html_url);
        embed.setAuthor({
          name: ev.payload.sender.login,
          iconURL: ev.payload.sender.avatar_url,
          url: ev.payload.sender.html_url,
        });
        embed.setDescription(
          (ev.payload.pull_request.body?.length || 0) > 4096
            ? ev.payload.pull_request.body?.substring(0, 4092) + "..."
            : ev.payload.pull_request.body
        );

        embed.setFooter({
          text: `🟢-${ev.payload.pull_request.additions}\n🟠-${ev.payload.pull_request.changed_files}\n🔴-${ev.payload.pull_request.deletions}`,
        });
        if (!this.webhookChannel) return;

        let channel = (await this.webhookChannel.threads.fetch()).threads.find(
          (x) =>
            x.name === "Pull-Requests" && x.parentId === this.webhookChannel?.id
        ) as ThreadChannel;
        if (!channel) {
          if (this.webhookChannel instanceof ForumChannel) {
            channel = await this.webhookChannel.threads.create({
              name: "Pull-Requests",
              message: { content: "Pull Request Updates will be posted here" },
            });
          } else {
            channel = await this.webhookChannel.threads.create({
              name: "Pull-Requests",
            });
          }
        }
        if (channel?.archived && channel.unarchivable) {
          await channel.setArchived(false);
        }
        await channel?.send({ embeds: [embed] });
      } catch (e) {
        console.error(e);
      }
    });

    this.webhooks.on("pull_request.closed", async (ev) => {
      try {
        this.getUsersForIssue(ev.payload.pull_request.number).then((x) =>
          this.handlePullRequestSubscription(x, ev, true)
        );

        const embed = new EmbedBuilder();

        embed.setTitle(
          (ev.payload.pull_request.merged ? "Merged: " : "Closed: ") +
            ev.payload.pull_request.title
        );
        embed.setURL(ev.payload.pull_request.html_url);
        embed.setAuthor({
          name: ev.payload.sender.login,
          iconURL: ev.payload.sender.avatar_url,
          url: ev.payload.sender.html_url,
        });

        embed.setFooter({
          text: `🟢-${ev.payload.pull_request.additions}\n🟠-${ev.payload.pull_request.changed_files}\n🔴-${ev.payload.pull_request.deletions}`,
        });
        if (!this.webhookChannel) return;

        let channel = (await this.webhookChannel.threads.fetch()).threads.find(
          (x) =>
            x.name === "Pull-Requests" && x.parentId === this.webhookChannel?.id
        ) as ThreadChannel;
        if (!channel) {
          if (this.webhookChannel instanceof ForumChannel) {
            channel = await this.webhookChannel.threads.create({
              name: "Pull-Requests",
              message: { content: "Pull Request Updates will be posted here" },
            });
          } else {
            channel = await this.webhookChannel.threads.create({
              name: "Pull-Requests",
            });
          }
        }
        if (channel?.archived && channel.unarchivable) {
          await channel.setArchived(false);
        }
        await channel?.send({ embeds: [embed] });
      } catch (e) {
        console.error(e);
      }
    });
    if (process.env.DEVELOPMENT === "1") {
      const webhookProxyUrl = process.env.WEBHOOK_PROXY_URL!;
      const source = new EventSource(webhookProxyUrl);
      source.onmessage = (event) => {
        const webhookEvent = JSON.parse(event.data);
        this.webhooks
          .verifyAndReceive({
            id: webhookEvent["x-request-id"],
            name: webhookEvent["x-github-event"],
            signature: webhookEvent["x-hub-signature"],
            payload: webhookEvent.body,
          })
          .catch(console.error);
      };
    }
    http
      .createServer(createNodeMiddleware(this.webhooks))
      .listen(process.env.WEBHOOK_PORT || 3030);
  }

  async addUserSubscription(userId: string, issue: number) {
    return await this.userSubscriptionRepository.createUserSubscription(
      userId,
      Number(issue)
    );
  }

  async unsubscribeUser(userId: string, issue: number) {
    return await this.userSubscriptionRepository.deleteUserSubscription(
      userId,
      Number(issue)
    );
  }

  async getUserSubscription(user: string, issue: number) {
    return await this.userSubscriptionRepository.getUserSubscription(
      user,
      Number(issue)
    );
  }

  async getUsersForIssue(issue: number) {
    return await this.userSubscriptionRepository.getUserSubscriptionByIssueId(
      Number(issue)
    );
  }

  async handleIssueSubscription(
    payload: UserSubscription[],
    issue: any,
    closed?: boolean
  ) {
    const dmEmbed = new EmbedBuilder();
    if (closed) {
      dmEmbed.setTitle(
        "Closed: " +
          (issue.payload.issue.title.length > 220
            ? issue.payload.issue.title.substring(0, 220) + "..."
            : issue.payload.issue.title) +
          " #" +
          issue.payload.issue.number
      );
      dmEmbed.setDescription(
        issue.payload.issue.title +
          " was closed by " +
          issue.payload.sender.login +
          "."
      );
    } else {
      issue.payload.comment.body = githubService.cleanseIssueBody(
        issue.payload.comment.body
      );

      dmEmbed.setTitle(
        "New Comment to " +
          (issue.payload.issue.title.length > 220
            ? issue.payload.issue.title.substring(0, 220) + "..."
            : issue.payload.issue.title) +
          " #" +
          issue.payload.issue.number
      );
      dmEmbed.setDescription(
        (issue.payload.comment.body?.length || 0) > 4096
          ? issue.payload.comment.body?.substring(0, 4092) + "..."
          : issue.payload.comment.body
      );
    }
    dmEmbed.setURL(issue.payload.issue.html_url);
    dmEmbed.setAuthor({
      name: issue.payload.sender.login,
      iconURL: issue.payload.sender.avatar_url,
      url: issue.payload.sender.html_url,
    });

    const unsubscribeButton = new ButtonBuilder()
      .setCustomId(`unsubscribe-${issue.payload.issue.number}`)
      .setLabel("Unsubscribe")
      .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      unsubscribeButton
    );

    payload.forEach(async (user) => {
      bot.users.fetch(user.userId).then(async (user) => {
        let channel = user.dmChannel;
        if (!channel) {
          channel = await user.createDM(false);
        }

        channel.send({
          embeds: [dmEmbed],
          components: [row],
        });
      });
    });
  }

  async handlePullRequestSubscription(
    payload: UserSubscription[],
    pull_request: any,
    closed?: boolean
  ) {
    const dmEmbed = new EmbedBuilder();
    if (closed) {
      dmEmbed.setTitle(
        "Closed: " +
          (pull_request.payload.pull_request.title.length > 220
            ? pull_request.payload.pull_request.title.substring(0, 220) + "..."
            : pull_request.payload.pull_request.title) +
          " #" +
          pull_request.payload.pull_request.number
      );
      dmEmbed.setDescription(
        pull_request.payload.pull_request.title +
          " was closed by " +
          pull_request.payload.sender.login +
          "."
      );
    } else {
      pull_request.payload.comment.body = githubService.cleanseIssueBody(
        pull_request.payload.comment.body
      );
      dmEmbed.setTitle(
        "New Comment to " +
          (pull_request.payload.pull_request.title.length > 220
            ? pull_request.payload.pull_request.title.substring(0, 220) + "..."
            : pull_request.payload.pull_request.title) +
          " #" +
          pull_request.payload.pull_request.number
      );
      dmEmbed.setDescription(
        (pull_request.payload.comment.body?.length || 0) > 4096
          ? pull_request.payload.comment.body?.substring(0, 4092) + "..."
          : pull_request.payload.comment.body
      );
    }
    dmEmbed.setURL(pull_request.payload.pull_request.html_url);
    dmEmbed.setAuthor({
      name: pull_request.payload.sender.login,
      iconURL: pull_request.payload.sender.avatar_url,
      url: pull_request.payload.sender.html_url,
    });

    const unsubscribeButton = new ButtonBuilder()
      .setCustomId(`unsubscribe-${pull_request.payload.pull_request.number}`)
      .setLabel("Unsubscribe")
      .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      unsubscribeButton
    );

    payload.forEach(async (user) => {
      bot.users.fetch(user.userId).then(async (user) => {
        let channel = user.dmChannel;
        if (!channel) {
          channel = await user.createDM(false);
        }

        channel.send({
          embeds: [dmEmbed],
          components: [row],
        });
      });
    });
  }
}
