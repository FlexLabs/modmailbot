const Eris = require("eris");
const { createThreadFromInteraction, awaitingOpen } = require("../main");
const components = require("../utils/components");
const bot = require("../bot");
const main = require("../main");

module.exports = {
  name: "threadopenmoderation",
  type: Eris.Constants.InteractionTypes.MESSAGE_COMPONENT,
  /**
   * @param {Eris.ComponentInteraction} interaction
   * @param {String} customID
   */
  handler: async (interaction, customID) => {
    const { message } = interaction;

    if (! ("user" in interaction)) {
      throw new Error(`Unexpected channel type ${message.channel.type} from ${message.jumpLink}`);
    }
    const opening = awaitingOpen.get(message.channel.id);
    if (! opening || Date.now() - opening.timestamp > 300000) {
      return interaction.createMessage("Thread creation timed out. Please send another message and try again.");
    }

    switch (customID) {
      case "reportUser": {
        await bot.createInteractionResponse(interaction.id, interaction.token, {
          type: 9,
          data: components.reportUserModal
        });
        break;
      }
      case "dynoImp": {
        await interaction.createMessage("To report a Dyno impersonator, please file a Discord Trust & Safety report using the below link, and they will be able to assist you better.\n\n<https://dis.gd/request>\n\nThanks so much for taking time to report Dyno impostors, we really appreciate it!");
        break;
      }
      case "banAppeal": {
        await interaction.createMessage("If you're looking to appeal a ban, you can fill out the form below. Our moderation team will review and resolve it as quickly as we can.\n\nYou can monitor the status of your appeal by going back to the form. If you opt-in when submitting, Dyno will attempt to DM you the outcome of your appeal. Please note he won't be able to DM you if you don't have your DMs open to everybody or if you're in no mutual servers with Dyno.\n\nhttps://dyno.gg/form/6312b9f5");
        break;
      }
      case "cancel": {
        await interaction.createMessage("Cancelled thread creation, your message has not been forwarded to staff members.");
        break;
      }
      case "muteAppeal":
      case "idfk": {
        await createThreadFromInteraction(interaction, opening, null, "Moderation Help");
        break;
      }
      default: {
        main.awaitingOpen.delete(message.channel.id);
        return interaction.createMessage({
          content: "Unknown selection. Please send another message and try again.",
          flags: 64
        });
      }
    }
    if (customID !== "reportUser") awaitingOpen.delete(message.channel.id);
  }
};
