const humanizeDuration = require("humanize-duration");
const moment = require("moment");
const Eris = require("eris");
const SSE = require("express-sse");
const threads = require("../data/threads");
const threadUtils = require("../utils/threadUtils");
const utils = require("../utils/utils");
const { confirmClose, cancelClose } = require("../utils/components");

/**
 * @param {Eris.CommandClient} bot
 * @param {SSE} sse
 */
module.exports = (bot, sse) => {
  /**
   * @param {Number} delay
   * @param {humanizeDuration.Options} opts
   */
  const humanizeDelay = (delay, opts = {}) => humanizeDuration(delay, Object.assign({conjunction: " and "}, opts));

  // Check for threads that are scheduled to be closed and close them
  async function applyScheduledCloses() {
    const threadsToBeClosed = await threads.getThreadsThatShouldBeClosed();
    for (const thread of threadsToBeClosed) {
      await thread.close(null, false, sse);

      const logUrl = await thread.getLogUrl();
      utils.postLog(thread, (await utils.getMainGuild()).members.get(thread.scheduled_close_id), logUrl, "Scheduled close.");
    }
  }

  async function scheduledCloseLoop() {
    await applyScheduledCloses();

    setTimeout(scheduledCloseLoop, 2000);
  }

  scheduledCloseLoop();

  // Close a thread. Closing a thread saves a log of the channel's contents and then deletes the channel.
  threadUtils.addInboxServerCommand(bot, "close", async (msg, args, thread) => {
    if (args[0] === "missed") {
      const threadsShouldClosed = await threads.getThreadsThatShouldBeClosed();
      if (threadsShouldClosed.length === 0) return bot.createMessage(msg.channel.id, "No threads that should be closed");
      const threadList = threadsShouldClosed.map((t) => `${t.user_name} (${t.user_id}) - <#${t.channel_id}>`).join("\n");

      bot.createMessage(msg.channel.id, threadList);
    }

    if (! thread) return;

    // Timed close
    if (args.length) {
      if (args[0] === "cancel") {
        // Cancel timed close
        if (thread.scheduled_close_at) {
          await thread.cancelScheduledClose();
          utils.postSuccess(thread, "***Thread close has been canceled.***");
        } else {
          utils.postError(thread, "This thread is not scheduled to close!");
        }

        return;
      } else if (args[0] === "status") {
        let message;
        if (thread.scheduled_close_at) {
          message = `Closing <t:${moment(thread.scheduled_close_at).unix()}:R>\nScheduled by ${thread.scheduled_close_name} (${thread.scheduled_close_id})`;
        } else {
          message = "This thread is not scheduled to close!";
        }
        utils.postInfo(thread, message);
        return;
      } else if (args[0] === "force") {
        //if (! utils.isAdmin(msg.member) || ! msg.member.roles.includes("987377218927861760")) return;
        await thread.close(msg.author, false, sse);
        const logUrl = await thread.getLogUrl();
        utils.postLog(thread, msg.author, logUrl, "Force closed.");
        return;
      }

      // Set a timed close
      const delay = utils.convertDelayStringToMS(args.join(" "));
      const closeAt = moment.utc().add(delay, "ms");
      if (delay === null) {
        utils.postError(thread, "Invalid delay specified. Format: \"1h30m\"");
        return;
      }

      if (delay <= 299000) {
        utils.postInfo(thread, "An interval of at least `5m` is required.");
        return;
      }

      if (delay === 314000) { // Pi easter egg
        if (msg.author.id !== "334093318818627586") {
          utils.postError(thread, "Only Pi can set a thread to close for 314 seconds!");
          return;
        }

        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), msg.author);
        // eslint-disable-next-line no-useless-escape
        return utils.postSuccess(thread, "**Thread will now close in π \* 100 seconds**", cancelClose);
      } else {
        await thread.scheduleClose(closeAt.format("YYYY-MM-DD HH:mm:ss"), msg.author);
        return utils.postSuccess(thread, `***Thread will now close in ${humanizeDelay(delay)}***`, cancelClose);
      }
    }

    // Regular close
    const conformation = {
      embeds: [{
        description: "<:DaveEgg:698046132605157396> Select an option below to close the thread.\nYou can also use `!close [time]` to schedule a time manualy.",
        color: 0x337FD5,
      }],
      components: confirmClose,
    };

    return await thread.postSystemMessage(conformation, true);
  });

  // Auto-close threads if their channel is deleted
  bot.on("channelDelete", async (channel) => {
    if (! (channel instanceof Eris.TextChannel)) return;
    if (channel.guild.id !== (await utils.getInboxGuild().id)) return;
    const thread = await threads.findOpenThreadByChannelId(channel.id);
    if (! thread) return;

    console.log(`[INFO] Auto-closing thread with ${thread.user_name} because the channel was deleted`);
    let auditLogs = await channel.guild.getAuditLog({ limit: 50, actionType: 12});
    let entry = auditLogs.entries.find(e => e.targetID === channel.id);
    await thread.close(entry ? entry.user : null, true, sse);

    const logUrl = await thread.getLogUrl();
    utils.postLog(thread, bot.user, logUrl, "Thread channel deleted.");
  });
};
