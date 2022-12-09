const Eris = require("eris");
const bot = require("../bot");
const components = require("../utils/components");
const config = require("../config");
const { createThreadFromInteraction, awaitingOpen } = require("../main");
const snippets = require("../data/snippets");
const utils = require("../utils/utils");

module.exports = {
  name: "threadopen",
  type: [Eris.Constants.InteractionTypes.MESSAGE_COMPONENT, 5],
  /**
   * @param {Eris.ComponentInteraction} interaction
   * @param {String} customID
   */
  handler: async (interaction, customID) => {
    const { message } = interaction;

    await interaction.editParent({
      content: message.content,
      components: [{
        type: 1,
        components: message.components[0].components.map((c) => {
          c.disabled = true;
          c.style = c.custom_id === interaction.data.custom_id ? c.style : 2;
          return c;
        })
      }]
    });

    if (! ("user" in interaction)) {
      throw new Error(`Unexpected channel type ${message.channel.type} from ${message.jumpLink}`);
    }
    const opening = awaitingOpen.get(message.channel.id);
    if (! opening || Date.now() - opening.timestamp > 300000) {
      return interaction.createFollowup("Thread creation timed out. Please send another message and try again.");
    }

    switch(customID) {
      case "cancel": {
        await interaction.createFollowup("Cancelled thread creation, your message has not been forwarded to staff members.");
        break;
      }
      case "support": {
        let snip = await snippets.get("sup");
        let premSnip = await snippets.get("premsup");
        let supMsg = snip ? snip.body : config.dynoSupportMessage;
        let premMsg = premSnip ? premSnip.body : config.dynoPremiumSupport;
        if (! supMsg) throw new Error("Support redirect snippet does not exist");
        const member = bot.guilds.get("203039963636301824").members.get(interaction.user.id);
        if (member && member.roles.includes("265342465483997184") && premMsg) {
          supMsg += premMsg;
        }
        await interaction.createFollowup(supMsg);
        break;
      }
      case "iWantStaff": {
        let snip = await snippets.get("staffapp");
        if (! snip) throw new Error("Staff application snippet does not exist");
        await interaction.createFollowup(snip.body);
        break;
      }
      case "moderation": {
        await interaction.createFollowup({
          content: "Please specify what you need help with, and I'll connect you with a member of our moderation team!",
          components: components.moderationHelpReasons
        });
        break;
      }
      case "userReport": {
        let [userID, reason, context] = interaction.data.components.map((c) => c.components[0].value);
        let copyID = {
          type: 2,
          style: 1,
          label: "Send Reported User ID",
          custom_id: "reporteduser:sendID-" + userID
        };
        const mainGuild = bot.guilds.get(config.mainGuildId);

        // Transform User ID to tag
        if (! isNaN(userID) && userID.length > 16 && userID.length < 20 && mainGuild) {
          const search = mainGuild.members.get(userID);

          if (search) {
            userID = `**${search.username}#${search.discriminator}** (\`${userID}\`)`;
          }
        }

        const fields = [
          {
            name: "User",
            value: userID
          },
          {
            name: "Reason",
            value: reason
          }
        ];

        if (context) {
          fields.push({
            name: "Additional Content/Links",
            value: context
          });
        }

        const member = mainGuild.members.get(interaction.user.id);
        await createThreadFromInteraction(interaction, opening, {
          embed: {
            title: "**User Report**",
            color: utils.getUserRoleColor(member),
            fields
          },
          components: [{
            type: 1,
            components: [copyID]
          }]
        }, "Moderation Help");
        break;
      }
      case "premiumPayment":
      case "noFuckingClue": {
        const label = message.components[0].components.find((c) => c.custom_id === interaction.data.custom_id).label;
        await createThreadFromInteraction(interaction, opening, null, label);
      }
    }
    if (customID !== "moderation") {
      awaitingOpen.delete(message.channel.id);
    }
  }
};
