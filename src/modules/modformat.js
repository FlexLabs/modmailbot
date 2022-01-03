const Eris = require("eris");
const threadUtils = require("../threadUtils");

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
      let idArray = [];
      for await (const message of messages) {
        if (/(?:whois|modlogs|modinfo)\s\d{16,}/.test(message.body)) {
          idArray.push(message.body.split(" ")[1]);
        }}
      let lastItem = " ";
      for (let i = 0; i < idArray.length; i++) {
        if (idArray[i] != thread.user_id) {
          lastItem = idArray[i];
        }
      }

      bot.createMessage(msg.channel.id, `${lastItem} ${reason} | ${thread.id}`.trim());
    } else {
      const reason = args.join(" ").trim();
      bot.createMessage(msg.channel.id, `${reason} | ${thread.id}`);
    }
  });
  bot.registerCommandAlias("mf", "modformat");
};