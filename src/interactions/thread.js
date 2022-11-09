const Eris = require("eris");
const moment = require("moment");
const blocked = require("../data/blocked");
const bot = require("../bot");
const components = require("../utils/components");
const config = require("../config");
const snippets = require("../data/snippets");
const threads = require("../data/threads");
const utils = require("../utils/utils");

const redirectCooldown = new Map;

module.exports = {
  name: "thread",
  type: Eris.Constants.InteractionTypes.MESSAGE_COMPONENT,
  /**
   * @param {Eris.ComponentInteraction} interaction
   * @param {String} customID
   */
  handler: async (interaction, customID, sse) => {
    const { message } = interaction;
    const thread = await threads.findByChannelId(message.channel.id);

    if (! thread) throw new Error("Unknown thread: " + message.channel.id);

    switch (customID) {
      case "sendUserID": {
        await interaction.createMessage({
          content: thread.user_id,
          flags: 64
        });
        break;
      }
      case "sendThreadID": {
        await interaction.createMessage({
          content: thread.id,
          flags: 64
        });
        break;
      }
      case "redirectAdmins": { // TODO Add redirectDevs
        const targetCategory = message.channel.guild.channels.get(config.adminThreadCategoryId);

        if (! targetCategory || ! config.allowedCategories.includes(targetCategory.id)) {
          return interaction.createMessage("I can't move this thread to the admin category because it doesn't exist, or I'm not allowed to move threads there.");
        }

        if (message.channel.parentID === targetCategory.id) {
          return interaction.createMessage(`This thread is already inside of the ${targetCategory.name} category.`);
        }

        await interaction.createMessage({
          content: `Are you sure you want to move this thread to ${targetCategory.name}?`,
          components: components.moveToAdmins
        });
        break;
      }
      case "redirectSupport": {
        const cooldown = redirectCooldown.get(thread.id);

        if (cooldown && Date.now() - cooldown.timestamp < 10000) {
          interaction.createMessage({
            content: (cooldown.member.id === interaction.member.id ? "You've" : `${cooldown.member.username} has`) + " only just redirected this user to the support channels.",
            flags: 64
          });
        } else {
          let snip = await snippets.get("sup");
          if (! snip) throw new Error("Support redirect snippet does not exist");
          snip = snip.body;
          const member = message.channel.guild.members.get(thread.user_id);
          if (member && member.roles.includes("265342465483997184")) {
            snip += config.dynoPremiumSupport;
          }

          interaction.acknowledge();
          await thread.replyToUser(interaction.member, snip, [], config.replyAnonDefault);
          redirectCooldown.set(thread.id, {
            member: interaction.member,
            timestamp: Date.now()
          });
        }
        break;
      }
      case "blockUser": {
        const isBlocked = await blocked.isBlocked(thread.user_id);

        if (isBlocked) {
          interaction.createMessage({
            content: `${thread.user_name} is already blocked!`,
            flags: 64
          });
          break;
        }

        const modal = components.blockUserModal;

        if (thread.user_name) {
          modal.title = `Block ${thread.user_name}!`;
        }

        await bot.createInteractionResponse(interaction.id, interaction.token, {
          type: 9,
          data: modal
        });
        break;
      }
      case "close": {
        await thread.close(interaction.member, false, sse);

        const logUrl = await thread.getLogUrl();
        utils.postLog(thread, interaction.member, logUrl);
        break;
      }
      case "closeIn10": {
        const closeAt = moment.utc().add(600000, "ms");

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        interaction.createMessage(`Thread will close in 10 minutes. Use \`${config.prefix}close cancel\` to cancel.`);
        break;
      }
      default: {
        return interaction.createMessage({
          content: "Unknown button",
          flags: 64
        });
      }
    }
  }
};
