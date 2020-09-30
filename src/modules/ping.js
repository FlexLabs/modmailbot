const Eris = require("eris");
const threadUtils = require("../threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "ping", async (msg) => {
    msg.channel.createMessage("Pong!").then(m => m.edit(`Pong! \`${m.createdAt - msg.createdAt}ms\``));
  });
};
