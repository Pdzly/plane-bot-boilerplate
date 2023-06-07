import {
  EmbedBuilder,
  type CommandInteraction,
  type Message,
  ApplicationCommandOptionType,
} from "discord.js";
import type { SimpleCommandMessage } from "discordx";
import {
  Discord,
  SimpleCommand,
  SimpleCommandOption,
  SimpleCommandOptionType,
  Slash,
  SlashChoice,
  SlashGroup,
  SlashOption,
} from "discordx";

@Discord()
export class infoCommands {
  @Slash({ name: "guide", description: "Link to the Quick Start guide" })
  guide(interaction: CommandInteraction): void {
    interaction.reply("> Here you go: https://docs.plane.so/quick-start");
  }

  @Slash({ name: "self-host", description: "Link to the Self-Host guide" })
  selfhost(interaction: CommandInteraction): void {
    interaction.reply("> Here you go: https://docs.plane.so/self-hosting");
  }

  @Slash({ name: "docs", description: "Link to the Plane Docs" })
  mainpage(interaction: CommandInteraction): void {
    interaction.reply("> Here you go: https://docs.plane.so");
  }

  @Slash({
    name: "core",
    description: "Link to Core Concepts of Plane in the Docs",
  })
  coreconcepts(
    @SlashChoice(
      { name: "Workspaces", value: "workspaces" },
      { name: "Projects", value: "projects" },
      { name: "Issues", value: "issues" },
      { name: "Cycles", value: "cycles" },
      { name: "Modules", value: "modules" },
      { name: "View", value: "views" },
      { name: "Pages", value: "pages" },
      { name: "Analytics", value: "analytics" },
      { name: "Command Menu", value: "command-menu" }
    )
    @SlashOption({
      description: "What concept?",
      name: "concept",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    concept: string,
    interaction: CommandInteraction
  ): void {
    interaction.reply("> Here you go: https://docs.plane.so/" + concept);
  }
}
