const Eris = require("eris");
const blocked = require("../data/blocked");
const threads = require("../data/threads");

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
      return interaction.createMessage({
        content: `${thread.user_name} is already blocked!`,
        flags: 64
      });
    }
    if (! isBlocked && customID === "unblock") {
      return interaction.createMessage({
        content: `${thread.user_name} is not blocked!`,
        flags: 64
      });
    }

    const reason = interaction.data.components[0].components[0].value;
    const moderator = interaction.member;

    await blocked[customID](thread.user_id, thread.user_name, moderator.id)
      .then(() => {
        if (customID === "block") thread.replyToUser(moderator, `You have been blocked for ${reason}`, []);
        blocked.logBlock({
          id: thread.user_id,
          username: thread.user_name.split("#")[0],
          discriminator: thread.user_name.split("#")[1]
        }, moderator, reason, customID === "unblock");
        interaction.createMessage(`Blocked <@${thread.user_id}> (${thread.user_id}) from modmail!`);
      });
  }
};
