const Eris = require("eris");
const threads = require("../data/threads");

module.exports = {
  name: "reporteduser",
  type: Eris.Constants.InteractionTypes.MESSAGE_COMPONENT,
  /**
   * @param {Eris.ComponentInteraction} interaction
   * @param {String} customID
   */
  handler: async (interaction, customID) => {
    const { message } = interaction;

    const thread = await threads.findByChannelId(message.channel.id);
    if (! thread) throw new Error("Unknown thread: " + message.channel.id);

    const [action, userID] = customID.split("-");

    switch(action) {
      case "sendID": {
        interaction.createMessage({
          content: userID,
          flags: 64
        });
        break;
      }
      default: {
        interaction.createMessage("Unknown action");
      }
    }
  }
};
