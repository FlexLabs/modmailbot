const Eris = require("eris");
const threadUtils = require("../utils/threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "modformat", async (msg, args, thread) => {
    if (! thread) return;
    if (args[0] === "id") {
      args.shift();

      const reason = args.join(" ").trim();
      const messages = await thread.getThreadMessages();
      const idArray = [];

      for await (const message of messages) {
        if (/(?:w|whois|modlogs|modinfo)\s<?@?!?\d{16,}>?/.test(message.body)) {
          let lastItem = message.body.split(" ")[1].match(/\d{16,}/);
          if(lastItem != thread.user_id) {
            idArray.push(lastItem);
          }
        }
      }

      bot.createMessage(msg.channel.id, `${idArray.pop() || ""} ${reason} | ${thread.id}`.trim());
    } else {
      const reason = args.join(" ").trim();
      bot.createMessage(msg.channel.id, `${reason} | ${thread.id}`);
    }
  });

  bot.registerCommandAlias("mf", "modformat");
};
