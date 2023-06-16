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
import UserSubscription, {
  UserSubscriptionSettings,
} from "../models/userSubscription.js";
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
        embed.setTitle(
          "New Issue: " +
            ev.payload.issue.title +
            " #" +
            ev.payload.issue.number
        );
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
        const goto = new ButtonBuilder()
          .setLabel("Goto Issue")
          .setStyle(ButtonStyle.Link)
          .setURL(ev.payload.issue.html_url);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(goto);

        await channel?.send({ embeds: [embed], components: [row] });
      } catch (e) {
        console.error(e);
      }
    });

    this.webhooks.on("issues.closed", async (ev) => {
      try {
        try {
          this.getUsersForIssue(ev.payload.issue.number).then((x) =>
            this.handleIssueSubscription(
              x,
              {
                title: ev.payload.issue.title,
                number: ev.payload.issue.number,
                url: ev.payload.issue.html_url,
                comment: { body: ev.payload.issue.body },
                sender: ev.payload.sender,
              },
              true
            )
          );
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
        const goto = new ButtonBuilder()
          .setLabel("Goto Issue")
          .setStyle(ButtonStyle.Link)
          .setURL(ev.payload.issue.html_url);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(goto);

        await channel?.send({ embeds: [embed], components: [row] });
      } catch (e) {
        console.error(e);
      }
    });

    this.webhooks.on("issue_comment.created", async (ev) => {
      try {
        try {
          this.getUsersForIssue(ev.payload.issue.number).then((x) => {
            if (ev.payload.issue.pull_request) {
              this.handlePullRequestSubscription(x, {
                title: ev.payload.issue.title,
                number: ev.payload.issue.number,
                url: ev.payload.issue.html_url,
                comment: { body: ev.payload.comment.body },
                sender: ev.payload.sender,
              });
            } else {
              this.handleIssueSubscription(x, {
                title: ev.payload.issue.title,
                number: ev.payload.issue.number,
                url: ev.payload.issue.html_url,
                comment: { body: ev.payload.comment.body },
                sender: ev.payload.sender,
              });
            }
          });
        } catch (e) {
          console.error(e);
        }
        const embed = new EmbedBuilder();
        embed.setTitle(
          "Comment to " +
            ev.payload.issue.title +
            " #" +
            ev.payload.issue.number
        );
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
        const goto = new ButtonBuilder()
          .setLabel("Goto Issue")
          .setStyle(ButtonStyle.Link)
          .setURL(ev.payload.issue.html_url);
        if (ev.payload.issue.pull_request !== undefined) {
          goto.setLabel("Goto Pull Request");
        }
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(goto);

        await channel.send({ embeds: [embed], components: [row] });
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

        const goto = new ButtonBuilder()
          .setLabel("Goto Pull Request")
          .setStyle(ButtonStyle.Link)
          .setURL(ev.payload.pull_request.html_url);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(goto);

        await channel?.send({ embeds: [embed], components: [row] });
      } catch (e) {
        console.error(e);
      }
    });

    this.webhooks.on("pull_request.closed", async (ev) => {
      try {
        this.getUsersForIssue(ev.payload.pull_request.number).then((x) =>
          this.handlePullRequestSubscription(
            x,
            {
              title: ev.payload.pull_request.title,
              url: ev.payload.pull_request.html_url,
              comment: { body: ev.payload.pull_request.body },
              number: ev.payload.pull_request.number,
              sender: ev.payload.sender,
            },
            true
          )
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

        const goto = new ButtonBuilder()
          .setLabel("Goto Pull Request")
          .setStyle(ButtonStyle.Link)
          .setURL(ev.payload.pull_request.html_url);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(goto);

        await channel?.send({ embeds: [embed], components: [row] });
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
            payload: JSON.stringify(webhookEvent.body),
          })
          .catch(console.error);
      };
    }
    http
      .createServer(createNodeMiddleware(this.webhooks))
      .listen(process.env.WEBHOOK_PORT || 3030);
  }

  async addUserSubscription(
    userId: string,
    issue: number,
    options: UserSubscriptionSettings
  ) {
    const subscription = this.userSubscriptionRepository.create();
    subscription.issueId = Number(issue);
    subscription.userId = userId;
    subscription.settings = options;
    return await this.userSubscriptionRepository.save(subscription);
  }

  async unsubscribeUser(userId: string, issue: number) {
    const subscription = await this.userSubscriptionRepository.findOne({
      where: {
        userId: userId,
        issueId: Number(issue),
      },
    });
    if (!subscription) return;
    return await this.userSubscriptionRepository.delete(subscription);
  }

  async getUserSubscription(user: string, issue: number) {
    return await this.userSubscriptionRepository.findOne({
      where: {
        userId: user,
        issueId: Number(issue),
      },
    });
  }

  async getUsersForIssue(issue: number) {
    return await this.userSubscriptionRepository.find({
      where: {
        issueId: Number(issue),
      },
    });
  }

  async handleIssueSubscription(
    payload: UserSubscription[],
    issue: {
      title: string;
      number: number;
      url: string;
      sender: { login: string; avatar_url: string; html_url: string };
      comment: { body: string | undefined | null };
    },
    closed?: boolean
  ) {
    const dmEmbed = new EmbedBuilder();
    if (closed) {
      dmEmbed.setTitle(
        "Closed: " +
          (issue.title.length > 220
            ? issue.title.substring(0, 220) + "..."
            : issue.title) +
          " #" +
          issue.number
      );
      dmEmbed.setDescription(
        issue.title + " was closed by " + issue.sender.login + "."
      );
    } else {
      issue.comment.body = githubService.cleanseIssueBody(issue.comment.body);

      dmEmbed.setTitle(
        "New Comment to " +
          (issue.title.length > 220
            ? issue.title.substring(0, 220) + "..."
            : issue.title) +
          " #" +
          issue.number
      );
      dmEmbed.setDescription(
        ((issue.comment.body?.length || 0) > 4096
          ? issue.comment.body?.substring(0, 4092) + "..."
          : issue.comment.body) || ""
      );
    }
    dmEmbed.setURL(issue.url);
    dmEmbed.setAuthor({
      name: issue.sender.login,
      iconURL: issue.sender.avatar_url,
      url: issue.sender.html_url,
    });

    const unsubscribeButton = new ButtonBuilder()
      .setCustomId(`unsubscribe-${issue.number}`)
      .setLabel("Unsubscribe")
      .setStyle(ButtonStyle.Secondary);

    const goto = new ButtonBuilder()
      .setLabel("Goto Issue")
      .setStyle(ButtonStyle.Link)
      .setURL(issue.url);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      goto,
      unsubscribeButton
    );

    payload.forEach(async (userData) => {
      const user = await bot.users.fetch(userData.userId);
      let channel = user.dmChannel;
      if (!channel) {
        channel = await user.createDM(false);
      }

      channel.send({
        embeds: [dmEmbed],
        components: [row],
      });
      if (closed && userData.settings.deleteOnClose) {
        await this.unsubscribeUser(userData.userId, issue.number);
      }
    });
  }

  async handlePullRequestSubscription(
    payload: UserSubscription[],
    pull_request: {
      title: string;
      number: number;
      url: string;
      sender: { login: string; avatar_url: string; html_url: string };
      comment: { body: string | undefined | null };
    },
    closed?: boolean
  ) {
    const dmEmbed = new EmbedBuilder();
    if (closed) {
      dmEmbed.setTitle(
        "Closed: " +
          (pull_request.title.length > 220
            ? pull_request.title.substring(0, 220) + "..."
            : pull_request.title) +
          " #" +
          pull_request.number
      );
      dmEmbed.setDescription(
        pull_request.title + " was closed by " + pull_request.sender.login + "."
      );
    } else {
      pull_request.comment.body = githubService.cleanseIssueBody(
        pull_request.comment.body
      );
      dmEmbed.setTitle(
        "New Comment to " +
          (pull_request.title.length > 220
            ? pull_request.title.substring(0, 220) + "..."
            : pull_request.title) +
          " #" +
          pull_request.number
      );
      dmEmbed.setDescription(
        ((pull_request.comment.body?.length || 0) > 4096
          ? pull_request.comment.body?.substring(0, 4092) + "..."
          : pull_request.comment.body) || ""
      );
    }
    dmEmbed.setURL(pull_request.url);
    dmEmbed.setAuthor({
      name: pull_request.sender.login,
      iconURL: pull_request.sender.avatar_url,
      url: pull_request.sender.html_url,
    });

    const unsubscribeButton = new ButtonBuilder()
      .setCustomId(`unsubscribe-${pull_request.number}`)
      .setLabel("Unsubscribe")
      .setStyle(ButtonStyle.Secondary);

    const goto = new ButtonBuilder()
      .setLabel("Goto Pull Request")
      .setStyle(ButtonStyle.Link)
      .setURL(pull_request.url);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      goto,
      unsubscribeButton
    );

    payload.forEach(async (userData) => {
      const user = await bot.users.fetch(userData.userId);
      let channel = user.dmChannel;
      if (!channel) {
        channel = await user.createDM(false);
      }

      channel.send({
        embeds: [dmEmbed],
        components: [row],
      });

      if (closed && userData.settings.deleteOnClose) {
        await this.unsubscribeUser(userData.userId, pull_request.number);
      }
    });
  }
}
