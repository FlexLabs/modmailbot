const Eris = require("eris");
const config = require("../config");
const threads = require("../data/threads");
const utils = require("../utils/utils");

module.exports = {
  name: "movethread",
  type: Eris.Constants.InteractionTypes.MESSAGE_COMPONENT,
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
          c.style = c.custom_id === `${this.name}:${customID}` ? c.style : 2;
          return c;
        })
      }]
    });

    const thread = await threads.findByChannelId(message.channel.id);
    if (! thread) throw new Error("Unknown thread: " + message.channel.id);

    if (customID === "cancel") {
      return utils.postInteractionError(interaction, "**Thread Transfer Cancelled.**", null, true);
    }

    if (customID === "modmail") {
      const targetCategory = message.channel.guild.channels.get(config.newThreadCategoryId);
      if (! targetCategory) {
        return utils.postInteractionError(interaction, `I can't move this thread to ${customID.toLowerCase()} because it doesn't exist.`);
      }
      if (message.channel.parentID === targetCategory.id) {
        return utils.postInteractionError(interaction, `This thread is already in ${targetCategory.name}.`, null, true);
      }
      return threads.moveThread(thread, targetCategory, false)
        .catch((e) => {
          utils.handleError(e);
          utils.postInteractionError(interaction, "Something went wrong while attempting to move this thread.", null, true);
        });
    } else if (customID === "community") {
      const targetCategory = message.channel.guild.channels.get(config.communityThreadCategoryId);
      if (! targetCategory) {
        return utils.postInteractionError(interaction, `I can't move this thread to ${customID.toLowerCase()} because it doesn't exist.`);
      }
      if (message.channel.parentID === targetCategory.id) {
        return utils.postInteractionError(interaction, `This thread is already in ${targetCategory.name}.`, null, true);
      }
      return threads.moveThread(thread, targetCategory, false)
        .catch((e) => {
          utils.handleError(e);
          utils.postInteractionError(interaction, "Something went wrong while attempting to move this thread.", null, true);
        });
    }
    else {
      const shouldPing = customID.endsWith("-ping");
      if (shouldPing) {
        customID = customID.replace("-ping", "");
      }

      const category = config.modmailCategories[customID.toLowerCase()];
      if (! category) {
        return utils.postInteractionError(interaction, "I can't find a category with that name.");
      }
      const targetCategory = message.channel.guild.channels.get(category.id);
      if (! targetCategory) {
        return utils.postInteractionError(interaction, `I can't move this thread to ${customID.toLowerCase()} because it doesn't exist.`);
      }

      if (message.channel.parentID === targetCategory.id) {
        return utils.postInteractionError(interaction, `This thread is already in ${targetCategory.name}.`, null, true);
      }

      return threads.moveThread(thread, targetCategory, shouldPing ? category.role : [])
        .catch((e) => {
          utils.handleError(e);
          utils.postInteractionError(interaction, "Something went wrong while attempting to move this thread.", null, true);
        });
    }
  }
};
