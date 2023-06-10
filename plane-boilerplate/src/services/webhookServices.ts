import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import http from "http";
import EventSource from "eventsource";
import {
  BaseGuildTextChannel,
  EmbedBuilder,
  ForumChannel,
  GuildForumThreadManager,
  ThreadChannel,
} from "discord.js";
import { bot } from "../main.js";
export default class webhookServices {
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
    });

    this.webhooks.on("issues.closed", async (ev) => {
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
    });

    this.webhooks.on("issue_comment.created", async (ev) => {
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
            ((ev.payload.issue.pull_request !== undefined && "Pull-Requests") ||
              "Issues") && x.parentId === this.webhookChannel?.id
      ) as ThreadChannel;
      if (!channel) {
        if (ev.payload.issue.pull_request !== undefined) {
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
    });

    this.webhooks.on("pull_request.opened", async (ev) => {
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
    });

    this.webhooks.on("pull_request.closed", async (ev) => {
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
}
