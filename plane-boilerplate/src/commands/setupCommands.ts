import {
  type CommandInteraction,
  ApplicationCommandOptionType,
} from "discord.js";
import { ArgsOf, Discord, On, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx";
import serverSettingsService from "../services/serverSettingsService.js";
import { Inject } from "typedi";

@Discord()
@SlashGroup({
  name: "setup",
  description: "Commands for moderators",
  defaultMemberPermissions: ["ManageGuild"],
})
@SlashGroup("setup")
export class setupCommands {
  @Inject()
  serverSettingsService: serverSettingsService;

  @Slash({
    name: "setauthrole",
    description: "Link the Verification Role for new users ( the role should be below the bot )",
  })
  async role(
    @SlashOption({
      description: "What role should be the Verification Role?",
      name: "roleid",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    role: string,
    interaction: CommandInteraction
  ) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const foundRole = await interaction.guild?.roles.fetch(role);
      if (!foundRole) {
        await interaction.editReply("Role not found");
        return;
      }
      await this.serverSettingsService.setAuthRole(interaction.guildId!, role);

      await interaction.editReply(`Role successfully set!
Please Note: This will not retroactively give the role to users that already accepted the rules.
You can use \`/patchroles\` to give the role to everyone that accepted the rules.`);
    } catch (exc) {
      console.error(exc);
      await interaction.editReply("Something went wrong.");
    }
  }

  @Slash({
    name: "patchroles",
    description: "Give everyone that accepted the rules the Verification Role ( it takes a while! )",
  })
  async patchrole(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const foundRoleId = await this.serverSettingsService.getAuthRole(
      interaction.guildId!
    );
    if (!foundRoleId) {
      await interaction.editReply("Role is not set");
      return;
    }
    const foundRole = await interaction.guild?.roles.fetch(foundRoleId);
    if (!foundRole) {
      await interaction.editReply("Role not found");
      return;
    }
    try {
      const members = await interaction.guild?.members.fetch();
      if (!members) {
        await interaction.editReply("No members found? Weird.");
        return;
      }
      let updatedMembers = 0;
      for (const member of members.values()) {
        if (member.roles.cache.has(foundRoleId) || member.pending) {
          continue;
        }
        await member.roles.add(foundRole);
        updatedMembers++;
      }
      await interaction.editReply("Done! Updated " + updatedMembers + " members.");
    } catch (exc) {
      console.error(exc);
      await interaction.editReply("Something went wrong.");
    }
  }

  @On({event: "guildMemberUpdate"})
  async onGuildMemberUpdate([oldMember, newMember]: ArgsOf<"guildMemberUpdate">) {
    const foundRoleId = await this.serverSettingsService.getAuthRole(
      newMember.guild.id
    );
    if (!foundRoleId) {
      return;
    }
    const foundRole = await newMember.guild.roles.fetch(foundRoleId);
    if (!foundRole) {
      return;
    }
    if (!newMember.roles.cache.has(foundRoleId) && oldMember.pending && !newMember.pending) {
      console.log("Adding role to " + newMember.user.username);
      try{
        await newMember.roles.add(foundRole);
      }catch(exc){
        console.error(exc);
      }
    }
  }
}
