const Eris = require("eris");
const config = require("../config");
const threads = require("../data/threads");
const { handleError } = require("../utils/utils");

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
      return interaction.createFollowup("Cancelled thread transfer.");
    }

    const shouldPing = customID.endsWith("-ping");
    if (shouldPing) {
      customID = customID.replace("-ping", "");
    }

    const category = config.modmailCategories[customID.toLowerCase()];
    if (! category) {
      return interaction.createFollowup("I was unable to find a valid category with that name.");
    }
    const targetCategory = message.channel.guild.channels.get(category.id);
    if (! targetCategory) {
      return interaction.createFollowup(`I can't move this thread to the ${customID.toLowerCase()} because it doesn't exist.`);
    }

    return threads.moveThread(thread, targetCategory, shouldPing ? category.role : [])
      .catch((e) => {
        handleError(e);
        interaction.createMessage("Something went wrong while attempting to move this thread.");
      });
  }
};
