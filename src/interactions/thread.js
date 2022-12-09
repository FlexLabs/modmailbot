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
          return utils.postInteractionError(interaction, "I can't move this thread to the admin category because it doesn't exist, or I'm not allowed to move threads there.");
        }

        if (message.channel.parentID === targetCategory.id) {
          return utils.postInteractionError(interaction, `This thread is already inside of the ${targetCategory.name} category.`);
        }

        await utils.postInteractionInfo(interaction, 
          `Are you sure you want to move this thread to ${targetCategory.name}?`,
          components.moveToAdmins
        );
        break;
      }
      case "redirectSupport": {
        const cooldown = redirectCooldown.get(thread.id);

        if (cooldown && Date.now() - cooldown.timestamp < 10000) {
          utils.postInteractionInfo(interaction,
            (cooldown.member.id === interaction.member.id ? "You've" : `${cooldown.member.username} has`) + " only just redirected this user to the support channels.",
            null,
            true
          );
        } else {
          let snip = await snippets.get("sup");
          let premSnip = await snippets.get("premsup");
          let supMsg = snip ? snip.body : config.dynoSupportMessage;
          let premMsg = premSnip ? premSnip.body : config.dynoPremiumSupport;
          if (! supMsg) throw new Error("Support redirect snippet does not exist");
          const member = message.channel.guild.members.get(thread.user_id);
          if (member && member.roles.includes("265342465483997184") && premMsg) {
            supMsg += premMsg;
          }

          interaction.acknowledge();
          await thread.replyToUser(interaction.member, supMsg, [], config.replyAnonDefault);
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
          utils.postInteractionError(interaction, `${thread.user_name} is already blocked!`, null, true);
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
      case "closeIn10m": {
        const closeAt = moment.utc().add(600000, "ms");

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        utils.postInteractionSuccess(interaction, `***Thread will now close in 10 minutes.***`, components.cancelClose);
        break;
      }
      case "closeIn15m": {
        const closeAt = moment.utc().add(900000, "ms");

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        utils.postInteractionSuccess(interaction, `***Thread will now close in 15 minutes.***`, components.cancelClose);
        break;
      }
      case "closeIn30m": {
        const closeAt = moment.utc().add(1800000, "ms");

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        utils.postInteractionSuccess(interaction, `***Thread will now close in 30 minutes.***`, components.cancelClose);
        break;
      }
      case "closeIn1h": {
        const closeAt = moment.utc().add(3600000, "ms");

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        utils.postInteractionSuccess(interaction, `***Thread will now close in 1 hour.***`, components.cancelClose);
      }
      case "closeIn24h": {
        const closeAt = moment.utc().add(86436000, "ms");

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        utils.postInteractionSuccess(interaction, `***Thread will now close in 24 hours.***`, components.cancelClose);
        break;
      }
      case "close314": {
        const closeAt = moment.utc().add(314000, "ms");

        if (interaction.member.id !== "334093318818627586") {
          return utils.postInteractionError(interaction, "Only Pi can select this!", null, true);
        }

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        utils.postInteractionSuccess(interaction, `***Thread will now close in π * 100 seconds.***`, components.cancelClose);
        break;
      }
      case "cancelClose": {
        if (thread.scheduled_close_at) {
          await thread.cancelScheduledClose();
          utils.postInteractionSuccess(interaction, "***Thread close has been canceled.***");
        } else {
          utils.postInteractionInfo(interaction, "This thread is not scheduled to close");
        }
        break;
      }
      case "suspend": {
        if (! thread) return;
        await thread.suspend();
        utils.postInteractionSuccess(interaction, "***Thread suspended*** | This thread will act as closed until unsuspended.", components.cancelSuspend);
        break;
      }
      case "cancelSuspend": {
        const suspendedThread = await threads.findSuspendedThreadByChannelId(interaction.channel.id);
        if (! suspendedThread) return;

        const otherOpenThread = await threads.findOpenThreadByUserId(suspendedThread.user_id);
        if (otherOpenThread) {
          utils.postInteractionError(interaction, `Cannot unsuspend; there is another open thread with this user: <#${otherOpenThread.channel_id}>`)
          return;
        }

        await thread.unsuspend();
        utils.postInteractionSuccess(interaction, "***Thread unsuspended***");
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
