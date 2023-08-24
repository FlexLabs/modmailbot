const Eris = require("eris");
const blocked = require("../data/blocked");
const threads = require("../data/threads");
const utils = require("../utils/utils");

module.exports = {
  name: "blockuser",
  type: Eris.Constants.InteractionTypes.MODAL_SUBMIT || 5, // TODO Move to eris constants once release is available
  /**
   * @param {*} interaction // TODO Use ModalSubmitComponent type
   * @param {String} customID
   */
  handler: async (interaction, customID) => {
    const { message } = interaction;

    const thread = await threads.findByChannelId(message.channel.id);
    if (! thread) throw new Error("Unknown thread: " + message.channel.id);

    const isBlocked = await blocked.isBlocked(thread.user_id);

    if (isBlocked && customID === "block") {
      return utils.postInteractionError(interaction, `${thread.user_name} is already blocked!`, null, true);
    }
    if (! isBlocked && customID === "unblock") {
      return utils.postInteractionError(interaction, `${thread.user_name} is not blocked!`, null, true);
    }

    const reason = interaction.data.components[0].components[0].value;
    const moderator = interaction.member;

    await blocked[customID](thread.user_id, thread.user_name, moderator.id)
      .then(() => {
        if (customID === "block") thread.replyToUser(moderator, `You have been blocked from modmail for: ${reason}`, []);
        blocked.logBlock({
          id: thread.user_id,
          username: thread.user_name,
          mention: `<@${thread.user_id}>`
        }, moderator, reason, customID === "unblock");
        utils.postInteractionSuccess(interaction, `***${thread.user_name} has been blocked from modmail!***`);
      });
  }
};
