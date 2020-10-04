const Eris = require("eris");
const threadUtils = require("../threadUtils");
const utils = require("../utils");
const threads = require("../data/threads");
const humanizeDuration = require("humanize-duration");
const notes = require("../data/notes");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "info", async (msg, args, thread) => {
    if (! thread) return;

    const now = Date.now();

    const user = bot.users.get(thread.user_id);
    const mainGuild = utils.getMainGuild();
    const member = mainGuild ? await bot.getRESTGuildMember(mainGuild.id, user.id).catch(() => null) : null;
  
    let mainGuildNickname = member && member.nick || user.username;
      
    const userLogCount = await threads.getClosedThreadCountByUserId(user.id);
    const accountAge = humanizeDuration(now - user.createdAt, {largest: 2});
    let memberFor;
    if (member) {
      memberFor = humanizeDuration(now - member.joinedAt, {largest: 2});
    }
    let displayNote;
    let userNotes = await notes.get(user.id);
    if (userNotes && userNotes.length) {
      let note = userNotes.slice(-1)[0];
      displayNote = `**Note [${userNotes.length}]:** ${note.note} - [${note.created_at}] (${note.created_by_name})\n`;
    } else
      displayNote = "";
    const infoHeader = `NAME **${mainGuildNickname}**\nMENTION ${user.mention}\nID **${user.id}**\nACCOUNT AGE **${accountAge}**\n`
      + `MEMBER FOR **${memberFor}**\nLOGS **${userLogCount}**\n${displayNote}────────────────────────────────`;
  
    await thread.postSystemMessage(infoHeader);
  });
};
