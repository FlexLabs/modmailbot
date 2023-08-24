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
  // eslint-disable-next-line no-unused-vars
  handler: async (interaction, customID, sse) => {
    const { message } = interaction;
    const thread = await threads.findByChannelId(message.channel.id);

    if (! thread) throw new Error("Unknown thread: " + message.channel.id);

    switch (customID) {
      case "sendUserId": {
        await interaction.createMessage({
          content: thread.user_id,
          flags: 64
        });
        break;
      }
      case "greetings": {
        await utils.postInteractionInfo(interaction, "Select a greeting to send.", components.greetingMenu, true);
        break;
      }
      case "moveThread": { // TODO Add redirect to Devs
        await utils.postInteractionInfo(interaction,
          "Confirm where you would like to move this thread.",
          components.moveMenu
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
          let premMsg = premSnip ? "\n\n" + premSnip.body : config.dynoPremiumSupport;
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
      // TODO: clean greetings up later or move to separate file - aly
      case "greeting1": {
        let snip = await snippets.get("help");
        if (! snip) return utils.postInteractionError(interaction, "I can't find that snippet", null, true);
        interaction.acknowledge();
        await thread.replyToUser(interaction.member, snip.body, [], config.replyAnonDefault);
        break;
      }
      case "greeting2": {
        let snip = await snippets.get("not4this");
        if (! snip) return utils.postInteractionError(interaction, "I can't find that snippet", null, true);
        interaction.acknowledge();
        await thread.replyToUser(interaction.member, snip.body, [], config.replyAnonDefault);
        break;
      }
      case "greeting3": {
        let snip = await snippets.get("moving");
        if (! snip) return utils.postInteractionError(interaction, "I can't find that snippet", null, true);
        interaction.acknowledge();
        await thread.replyToUser(interaction.member, snip.body, [], config.replyAnonDefault);
        break;
      }
      case "greeting4": {
        let snip = await snippets.get("transfer");
        if (! snip) return utils.postInteractionError(interaction, "I can't find that snippet", null, true);
        interaction.acknowledge();
        await thread.replyToUser(interaction.member, snip.body, [], config.replyAnonDefault);
        break;
      }
      case "greeting5": {
        let snip = await snippets.get("reportinfo");
        if (! snip) return utils.postInteractionError(interaction, "I can't find that snippet", null, true);
        interaction.acknowledge();
        await thread.replyToUser(interaction.member, snip.body, [], config.replyAnonDefault);
        break;
      }
      case "greeting6": {
        let snip = await snippets.get("discordreport");
        if (! snip) return utils.postInteractionError(interaction, "I can't find that snippet", null, true);
        interaction.acknowledge();
        await thread.replyToUser(interaction.member, snip.body, [], config.replyAnonDefault);
        break;
      }
      case "greeting7": {
        let snip = await snippets.get("dmads");
        if (! snip) return utils.postInteractionError(interaction, "I can't find that snippet", null, true);
        interaction.acknowledge();
        await thread.replyToUser(interaction.member, snip.body, [], config.replyAnonDefault);
        break;
      }
      case "greeting8": {
        let snip = await snippets.get("appeal");
        if (! snip) return utils.postInteractionError(interaction, "I can't find that snippet", null, true);
        interaction.acknowledge();
        await thread.replyToUser(interaction.member, snip.body, [], config.replyAnonDefault);
        break;
      }
      case "greeting9": {
        let snip = await snippets.get("lockdown");
        if (! snip) return utils.postInteractionError(interaction, "I can't find that snippet", null, true);
        interaction.acknowledge();
        await thread.replyToUser(interaction.member, snip.body, [], config.replyAnonDefault);
        break;
      }
      case "greeting10": {
        let snip = await snippets.get("status");
        if (! snip) return utils.postInteractionError(interaction, "I can't find that snippet", null, true);
        interaction.acknowledge();
        await thread.replyToUser(interaction.member, snip.body, [], config.replyAnonDefault);
        break;
      }
      case "closeIn10m": {
        const closeAt = moment.utc().add(600000, "ms");

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        utils.postInteractionSuccess(interaction, "***Thread will now close in 10 minutes***", components.cancelClose);
        break;
      }
      case "closeIn15m": {
        const closeAt = moment.utc().add(900000, "ms");

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        utils.postInteractionSuccess(interaction, "***Thread will now close in 15 minutes***", components.cancelClose);
        break;
      }
      case "closeIn30m": {
        const closeAt = moment.utc().add(1800000, "ms");

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        utils.postInteractionSuccess(interaction, "***Thread will now close in 30 minutes***", components.cancelClose);
        break;
      }
      case "closeIn1h": {
        const closeAt = moment.utc().add(3600000, "ms");

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        utils.postInteractionSuccess(interaction, "***Thread will now close in 1 hour***", components.cancelClose);
        break;
      }
      case "closeIn24h": {
        const closeAt = moment.utc().add(86436000, "ms");

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        utils.postInteractionSuccess(interaction, "***Thread will now close in 24 hours***", components.cancelClose);
        break;
      }
      case "close314": {
        const closeAt = moment.utc().add(314000, "ms");

        if (interaction.member.id !== "334093318818627586") {
          return utils.postInteractionError(interaction, "Only Pi can select this!", null, true);
        }

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), interaction.member);
        // eslint-disable-next-line no-useless-escape
        utils.postInteractionSuccess(interaction, "**Thread will now close in π \* 100 seconds**", components.cancelClose);
        break;
      }
      case "cancelClose": {
        if (thread.scheduled_close_at) {
          await thread.cancelScheduledClose();
          utils.postInteractionSuccess(interaction, "***Thread close has been canceled***");
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
          utils.postInteractionError(interaction, `Cannot unsuspend; there is another open thread with this user: <#${otherOpenThread.channel_id}>`);
          return;
        }

        await thread.unsuspend();
        utils.postInteractionSuccess(interaction, "***Thread unsuspended***");
        break;
      }
      default: {
        return utils.postInteractionError(interaction, "Unknown button", null, true);
      }
    }
  }
};
