const Eris = require("eris");
const SSE = require("express-sse");

const config = require("./config");
const bot = require("./bot");
const Queue = require("./queue");
const utils = require("./utils");
const blocked = require("./data/blocked");
const threads = require("./data/threads");

const reply = require("./modules/reply");
const alert = require("./modules/alert");
const role = require("./modules/role");
const purge = require("./modules/purge");
const tags = require("./modules/tags");
const command = require("./modules/command");
const close = require("./modules/close");
const snippets = require("./modules/snippets");
const logs = require("./modules/logs");
const move = require("./modules/move");
const block = require("./modules/block");
const suspend = require("./modules/suspend");
const webserver = require("./modules/webserver");
const greeting = require("./modules/greeting");
const typingProxy = require("./modules/typingProxy");
const version = require("./modules/version");
const newthread = require("./modules/newthread");
const notes = require("./modules/notes");
const idcmd = require("./modules/id");
const ping = require("./modules/ping");
const fixAttachment = require("./modules/img");
const git = require("./modules/git");
const restart = require("./modules/restart");
const info = require("./modules/info");
const setavatar = require("./modules/setavatar");
const dmlink = require("./modules/dmlink");
const stats = require("./modules/stats");

const attachments = require("./data/attachments");
const {ACCIDENTAL_THREAD_MESSAGES} = require("./data/constants");
const { mainGuildId } = require("./config");

const messageQueue = new Queue();
const sse = new SSE();
let webInit = false;

// Once the bot has connected, set the status/"playing" message
bot.on("ready", () => { // TODO Eris `type` is optional
  bot.editStatus(null, {name: config.status});
  console.log("Connected! Now listening to DMs.");
  let guild = bot.guilds.get(config.mainGuildId);
  let roles = [];
  let users = [];
  let channels = [];
  for (let role of guild.roles.values())
    roles.push({ id: role.id, name: role.name, color: role.color });
  for (let member of guild.members.values())
    users.push({ id: member.id, name: member.username, discrim: member.discriminator });
  for (let channel of guild.channels.values())
    channels.push({ id: channel.id, name: channel.name });
  sse.updateInit({
    roles: roles,
    users: users,
    channels: channels
  });
  webserver(bot, sse);
  webInit = true;
});

bot.on("guildAvailable", guild => {
  if (guild.id !== config.mainGuildId) { return; }
  if (webInit === true) { return; }
  console.log("Registering main guild.");
  let roles = [];
  let users = [];
  let channels = [];
  for (let role of guild.roles.values())
    roles.push({ id: role.id, name: role.name, color: role.color });
  for (let member of guild.members.values())
    users.push({ id: member.id, name: member.username, discrim: member.discriminator });
  for (let channel of guild.channels.values())
    channels.push({ id: channel.id, name: channel.name });
  sse.updateInit({
    roles: roles,
    users: users,
    channels: channels
  });
  webserver(bot, sse);
  webInit = true;
});

bot.on("error", (e) => process.emit("unhandledRejection", e, Promise.resolve()));

/**
 * When a moderator posts in a modmail thread...
 * 1) If alwaysReply is enabled, reply to the user
 * 2) If alwaysReply is disabled, save that message as a chat message in the thread
 */
bot.on("messageCreate", async msg => {
  if (! msg.guildID) return;
  if (! (await utils.messageIsOnInboxServer(msg))) return;
  if (msg.author.bot) return;
  if (! utils.isStaff(msg.member)) return; // Only run if messages are sent by moderators to avoid a ridiculous number of DB calls

  const thread = await threads.findByChannelId(msg.channel.id);
  if (! thread) return;

  if (msg.content.startsWith(config.prefix) || msg.content.startsWith(config.snippetPrefix)) {
    // Save commands as "command messages"
    if (msg.content.startsWith(config.snippetPrefix)) return; // Ignore snippets
    thread.saveCommandMessage(msg, sse);
  } else if (config.alwaysReply) {
    // AUTO-REPLY: If config.alwaysReply is enabled, send all chat messages in thread channels as replies

    if (msg.attachments.length) await attachments.saveAttachmentsInMessage(msg);
    await thread.replyToUser(msg.member, msg.content.trim(), msg.attachments, config.alwaysReplyAnon || false, sse);
    msg.delete();
  } else {
    // Otherwise just save the messages as "chat" in the logs
    thread.saveChatMessage(msg, sse);
  }
});

/**
 * When we get a private message...
 * 1) Find the open modmail thread for this user, or create a new one
 * 2) Post the message as a user reply in the thread
 */
bot.on("messageCreate", async msg => {
  if (! (msg.channel instanceof Eris.PrivateChannel)) return;
  if (msg.author.bot) return;
  if (msg.type !== 0) return; // Ignore pins etc.

  if (await blocked.isBlocked(msg.author.id)) return;

  if (msg.content.length > 1900) return bot.createMessage(msg.channel.id, `Your message is too long to be recieved by Dave. (${msg.content.length}/1900)`);
  // Private message handling is queued so e.g. multiple message in quick succession don't result in multiple channels being created
  messageQueue.add(async () => {
    let thread = await threads.findOpenThreadByUserId(msg.author.id);

    // New thread
    if (! thread) {
      // Ignore messages that shouldn't usually open new threads, such as "ok", "thanks", etc.
      if (config.ignoreAccidentalThreads && msg.content && ACCIDENTAL_THREAD_MESSAGES.includes(msg.content.trim().toLowerCase())) return;

      if (config.ignoreNonAlphaMessages && msg.content) {
        const content = msg.content.replace(/[^a-zA-Z0-9]/g, "");
        if (! content || ! content.length) {
          return bot.createMessage(msg.channel.id, config.genericResponse);
        }
      }

      if (config.minContentLength && msg.content && msg.content.length < config.minContentLength) {
        return bot.createMessage(msg.channel.id, config.genericResponse);
      }

      if (config.ignoredPrefixes && msg.content) {
        for (let pref of config.ignoredPrefixes) {
          if (! msg.content.startsWith(pref)) continue;
          // return if we don't want to auto respond
          if (! config.ignoredPrefixAutorespond) return;
          // respond and return if the message starts with an ignored prefix
          return bot.createMessage(msg.channel.id, config.ignoredPrefixResponse);
        }
      }

      if (config.ignoredWords && msg.content) {
        for (let word of config.ignoredWords) {
          if (! msg.content.toLowerCase().startsWith(word.toLowerCase())) continue;
          // return if we don't want to auto respond
          if (! config.ignoredWordAutorespond) return;
          // respond and return if the message starts with an ignored
          return bot.createMessage(msg.channel.id, config.ignoredWordResponse);
        }
      }

      if (config.autoResponses && config.autoResponses.length && msg.content) {
        const result = config.autoResponses.filter(o => o).find(o => {
          const doesMatch = (o, match) => {
            let text;

            if (o.matchStart) {
              if (! msg.content.toLowerCase().startsWith(match.toLowerCase())) return false;
              return true;
            }

            if (o.wildcard) {
              text = `.*${utils.regEscape(match)}.*`;
            } else {
              text = `^${utils.regEscape(match)}$`;
            }

            return msg.content.match(new RegExp(text, "i"));
          };

          if (Array.isArray(o.match)) {
            for (let m of o.match) {
              if (doesMatch(o, m)) return true;
            }
          } else {
            return doesMatch(o, o.match);
          }
        });

        if (result) {
          return bot.createMessage(msg.channel.id, result.response);
        }
      }

      try {
        thread = await threads.createNewThreadForUser(msg.author);
      } catch (error) {
        if (error.code === 50035 && error.message.includes("words not allowed")) {
          utils.postLog(`Tried to open a thread with ${msg.author.username}#${msg.author.discriminator} (${msg.author.id}) but failed due to a restriction on channel names for servers in Server Discovery`);
          return msg.channel.createMessage("Thread was unable to be opened - please change your username and try again!");
        }
        utils.postLog(`**Error:** \`\`\`js\nError creating modmail channel for ${msg.author.username}#${msg.author.discriminator}!\n${error.stack}\n\`\`\``);
        return msg.channel.createMessage("Thread was unable to be opened due to an unknown error. If this persists, please contact a member of the staff team!");
      }

      sse.send({ thread }, "threadOpen");
    }

    await thread.receiveUserReply(msg, sse);
  });
});

/**
 * When a message is edited...
 * 1) If that message was in DMs, and we have a thread open with that user, post the edit as a system message in the thread
 * 2) If that message was moderator chatter in the thread, update the corresponding chat message in the DB
 */
bot.on("messageUpdate", async (msg, oldMessage) => {
  if (! msg || ! msg.author) return;
  if (! (msg.channel instanceof Eris.PrivateChannel) || ! (await utils.messageIsOnInboxServer(msg)) && utils.isStaff(msg.member)) return;
  if (msg.author.bot) return;
  if (await blocked.isBlocked(msg.author.id)) return;
  if (msg.content.length > 1900) return bot.createMessage(msg.channel.id, `Your edited message (<${utils.discordURL("@me", msg.channel.id, msg.id)}>) is too long to be recieved by Dave. (${msg.content.length}/1900)`);

  // Old message content doesn't persist between bot restarts
  const oldContent = oldMessage && oldMessage.content || "*Unavailable due to bot restart*";
  const newContent = msg.content;

  // Ignore bogus edit events with no changes
  if (newContent.trim() === oldContent.trim()) return;

  // 1) Edit in DMs
  if (msg.channel instanceof Eris.PrivateChannel) {
    const thread = await threads.findOpenThreadByUserId(msg.author.id);
    const oldThreadMessage = await thread.getThreadMessageFromDM(msg);
    const editMessage = `**EDITED <${utils.discordURL(mainGuildId, thread.channel_id, oldThreadMessage.thread_message_id)}>:**\n${newContent}`;

    const newThreadMessage = await thread.postSystemMessage(editMessage);
    thread.updateChatMessage(msg, newThreadMessage);
  }

  // 2) Edit in the thread
  else if ((await utils.messageIsOnInboxServer(msg)) && utils.isStaff(msg.member)) {
    const thread = await threads.findOpenThreadByChannelId(msg.channel.id);
    if (! thread) return;

    thread.updateChatMessage(msg, msg);
  }
});

/**
 * @param {import('./data/Thread')} thread
 * @param {Eris.Message} msg
 */
async function deleteMessage(thread, msg) {
  if (! msg.author) return;
  if (msg.author.bot) return;
  if (! (await utils.messageIsOnInboxServer(msg))) return;
  if (! utils.isStaff(msg.member)) return;

  thread.deleteChatMessage(msg.id);
}

/**
 * When a staff message is deleted in a modmail thread, delete it from the database as well
 */
bot.on("messageDelete", async msg => {
  if (! msg.member) return; // Eris 0.15.0
  if (! utils.isStaff(msg.member)) return; // Only to prevent unnecessary DB calls, see first messageCreate event
  const thread = await threads.findOpenThreadByChannelId(msg.channel.id);
  if (! thread) return;

  deleteMessage(thread, msg);
});

bot.on("messageDeleteBulk", async messages => {
  const {channel, member} = messages[0];
  if (! member) return;

  if (! utils.isStaff(member)) return; // Same as above

  const thread = await threads.findOpenThreadByChannelId(channel.id);
  if (! thread) return;

  for (let msg of messages) {
    deleteMessage(thread, msg);
  }
});

/**
 * When the bot is mentioned on the main server, ping staff in the log channel about it
 */
bot.on("messageCreate", async msg => {
  if (msg.author.id === "155037590859284481" && msg.content === "$ping") {
    let start = Date.now();
    return bot.createMessage(msg.channel.id, "Pong! ")
    .then(m => {
        let diff = (Date.now() - start);
        return m.edit(`Pong! \`${diff}ms\``);
		});
  }
  if (! (await utils.messageIsOnMainServer(msg))) return;
  if (! msg.mentions.some(user => user.id === bot.user.id)) return;

  // If the person who mentioned the modmail bot is also on the modmail server, ignore them
  if ((await utils.getInboxGuild()).members.get(msg.author.id)) return;

  // If the person who mentioned the bot is blocked, ignore them
  if (await blocked.isBlocked(msg.author.id)) return;

  bot.createMessage((await utils.getLogChannel(bot)).id, {
    content: `${utils.getInboxMention()}Bot mentioned in <#${msg.channel.id}> by **${msg.author.username}#${msg.author.discriminator}**: "${msg.content}"`,
    allowedMentions: {
      everyone: false,
      roles: false,
      users: false,
    }
  });
});

// If a modmail thread is manually deleted, close the thread automatically
bot.on("channelDelete", async (channel) => {
  if (! (channel instanceof Eris.TextChannel)) return;
  if (channel.guild.id !== config.mailGuildId) return;

  const thread = await threads.findOpenThreadByChannelId(channel.id);
  if (thread) {
    await thread.close(bot.user, false, sse);

    const logUrl = await thread.getLogUrl();
    utils.postLog(
      utils.trimAll(`Modmail thread with ${thread.user_name} (${thread.user_id}) was closed due to channel deletion
      Logs: <${logUrl}>`)
    );
  }
});

module.exports = {
  async start() {
    // Connect to Discord
    console.log("Connecting to Discord...");
    await bot.connect();

    // Load modules
    console.log("Loading modules...");
    reply(bot, sse);
    alert(bot);
    role(bot);
    purge(bot);
    tags(bot);
    command(bot);
    close(bot, sse);
    logs(bot);
    block(bot);
    move(bot);
    snippets(bot);
    suspend(bot);
    notes(bot);
    greeting(bot);
    typingProxy(bot);
    version(bot);
    newthread(bot, sse);
    idcmd(bot);
    ping(bot);
    fixAttachment(bot);
    git(bot);
    restart(bot);
    info(bot);
    setavatar(bot);
    dmlink(bot);
    stats(bot);
  }
};
