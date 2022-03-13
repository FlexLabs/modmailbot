const Eris = require("eris");
const moment = require("moment");
const threads = require("../data/threads");
const threadUtils = require("../utils/threadUtils");
const utils = require("../utils/utils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "logs", (msg, args, thread) => {
    /**
     * @param {String} userId
     */
    async function getLogs(userId) {
      let userThreads = await threads.getClosedThreadsByUserId(userId);

      if (! utils.isAdmin(msg.member)) {
        userThreads = userThreads.filter((t) => ! t.isPrivate);
      }

      if (! userThreads.length) return bot.createMessage(msg.channel.id, "No logs found.");

      // Descending by date
      userThreads.sort((a, b) => {
        if (a.created_at > b.created_at) return -1;
        if (a.created_at < b.created_at) return 1;
        return 0;
      });

      const threadLines = await Promise.all(userThreads.map(async thread => {
        const logUrl = await thread.getLogUrl();
        const formattedDate = moment.utc(thread.created_at).format("YYYY-MM-DD HH:mm [UTC]");
        return `\`${formattedDate}\` ${thread.scheduled_close_name}: <${logUrl}>`;
      }));
      const message = `**Log files for <@${userId}>:**\n${threadLines.join("\n")}`;

      // Send the list of logs in chunks of 15 lines per message
      const lines = message.split("\n");
      const chunks = utils.chunk(lines, 15);

      /**
       * @type {Promise<Eris.Message|void>}
       */
      let root = Promise.resolve();
      chunks.forEach(lines => {
        root = root.then(() => bot.createMessage(msg.channel.id, lines.join("\n")));
      });
    }

    /**
     * @param {String} userId
     */
    async function deleteLogs(userId) {
      await threads.deleteClosedThreadsByUserId(userId);
      bot.createMessage(msg.channel.id, `Deleted log files for <@!${userId}>`);
    }

    let userId = thread && thread.user_id;

    if (args.length > 0) {
      if (args[0] === "delete" && utils.isAdmin(msg.member)) {
        const userId = utils.getUserMention(args.slice(1).join(" "));
        if (! userId) return utils.postSystemMessageWithFallback(msg.channel, thread, "Please provide a user mention or ID!");

        return deleteLogs(userId);
      }

      userId = utils.getUserMention(args.join(" "));
    }

    if (! userId) return utils.postSystemMessageWithFallback(msg.channel, thread, "Please provide a user mention or ID!");

    // Calling !logs without args in a modmail thread returns the logs of the user of that thread

    return getLogs(userId);
  });

  bot.registerCommand("loglink", async (msg, args) => {
    if (! (await utils.messageIsOnInboxServer(msg))) return;
    if (! utils.isStaff(msg.member)) return;

    if (args[0]) return msg.channel.createMessage(utils.getSelfUrl(`#thread/${args[0]}`));

    const thread = await threads.findOpenThreadByChannelId(msg.channel.id);
    if (! thread) return;

    const logUrl = await thread.getLogUrl();
    thread.postSystemMessage(`Log URL: <${logUrl}>`);
  });
};
