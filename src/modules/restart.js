const Eris = require("eris");
const threadUtils = require("../threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "restart", (msg) => {
    msg.channel.createMessage("Restarting...").then(() => process.exit(1));
  }, {
    requirements: {
      userIDs: ["253600545972027394"],
      roleIDs: ["203040224597508096", "523021576128692239"],
    }
  });
};