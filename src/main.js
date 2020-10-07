const Eris = require("eris");
const SSE = require("express-sse");

const config = require("./config");
const bot = require("./bot");
const Queue = require("./queue");
const utils = require("./utils");
const blocked = require("./data/blocked");
const threads = require("./data/threads");

const reply = require("./modules/reply");
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
const pull = require("./modules/pull");
const restart = require("./modules/restart");
const info = require("./modules/info");

const attachments = require("./data/attachments");
const {ACCIDENTAL_THREAD_MESSAGES} = require("./data/constants");

const messageQueue = new Queue();
const sse = new SSE();
let webInit = false;

// Once the bot has connected, set the status/"playing" message
bot.on("ready", () => {
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

/**
 * When a moderator posts in a modmail thread...
 * 1) If alwaysReply is enabled, reply to the user
 * 2) If alwaysReply is disabled, save that message as a chat message in the thread
 */
bot.on("messageCreate", async msg => {
  if (! utils.messageIsOnInboxServer(msg)) return;
  if (msg.author.bot) return;

  const thread = await threads.findByChannelId(msg.channel.id);
  if (! thread) return;

  if (msg.content.startsWith(config.prefix) || msg.content.startsWith(config.snippetPrefix)) {
    // Save commands as "command messages"
    if (msg.content.startsWith(config.snippetPrefix)) return; // Ignore snippets
    thread.saveCommandMessage(msg);
  } else if (config.alwaysReply) {
    // AUTO-REPLY: If config.alwaysReply is enabled, send all chat messages in thread channels as replies
    if (! utils.isStaff(msg.member)) return; // Only staff are allowed to reply

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

  if (msg.content.length > 1900) return msg.channel.createMessage(`Your message is too long to be recieved by Dave. (${msg.content.length}/1900)`);
  // Private message handling is queued so e.g. multiple message in quick succession don't result in multiple channels being created
  messageQueue.add(async () => {
    let thread = await threads.findOpenThreadByUserId(msg.author.id);

    // New thread
    if (! thread) {
      // Ignore messages that shouldn't usually open new threads, such as "ok", "thanks", etc.
      if (config.ignoreAccidentalThreads && msg.content && ACCIDENTAL_THREAD_MESSAGES.includes(msg.content.trim().toLowerCase())) return;

      if (config.ignoreNonAlphaMessages && msg.content) {
        const content = msg.content.replace(/[^a-zA-Z]/g, "");
        if (! content || ! content.length) {
          return msg.channel.createMessage(config.genericResponse);
        }
      }

      if (config.minContentLength && msg.content && msg.content.length < config.minContentLength) {
        return msg.channel.createMessage(config.genericResponse);
      }

      if (config.ignoredPrefixes && msg.content) {
        for (let pref of config.ignoredPrefixes) {
          if (! msg.content.startsWith(pref)) continue;
          // return if we don't want to auto respond
          if (! config.ignoredPrefixAutorespond) return;
          // respond and return if the message starts with an ignored prefix
          return msg.channel.createMessage(config.ignoredPrefixResponse);
        }
      }

      if (config.ignoredWords && msg.content) {
        for (let word of config.ignoredWords) {
          if (! msg.content.toLowerCase().startsWith(word.toLowerCase())) continue;
          // return if we don't want to auto respond
          if (! config.ignoredWordAutorespond) return;
          // respond and return if the message starts with an ignored
          return msg.channel.createMessage(config.ignoredWordResponse);
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
          return msg.channel.createMessage(result.response);
        }
      }

      thread = await threads.createNewThreadForUser(msg.author);

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
  if (msg.author.bot) return;
  if (await blocked.isBlocked(msg.author.id)) return;

  // Old message content doesn't persist between bot restarts
  const oldContent = oldMessage && oldMessage.content || "*Unavailable due to bot restart*";
  const newContent = msg.content;

  // Ignore bogus edit events with no changes
  if (newContent.trim() === oldContent.trim()) return;

  // 1) Edit in DMs
  if (msg.channel instanceof Eris.PrivateChannel) {
    const thread = await threads.findOpenThreadByUserId(msg.author.id);
    const editMessage = utils.disableLinkPreviews(`**The user edited their message:**\n\`B:\` ${oldContent}\n\`A:\` ${newContent}`);

    thread.postSystemMessage(editMessage);
  }

  // 2) Edit in the thread
  else if (utils.messageIsOnInboxServer(msg) && utils.isStaff(msg.member)) {
    const thread = await threads.findOpenThreadByChannelId(msg.channel.id);
    if (! thread) return;

    thread.updateChatMessage(msg);
  }
});

async function deleteMessage(thread, msg) {
  if (! msg.author) return;
  if (msg.author.bot) return;
  if (! utils.messageIsOnInboxServer(msg)) return;
  if (! utils.isStaff(msg.member)) return;

  thread.deleteChatMessage(msg.id);
}

/**
 * When a staff message is deleted in a modmail thread, delete it from the database as well
 */
bot.on("messageDelete", async msg => {
  const thread = await threads.findOpenThreadByChannelId(msg.channel.id);
  if (! thread) return;

  deleteMessage(thread, msg);
});

bot.on("messageDeleteBulk", async messages => {
  const channel = messages[0].channel;

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
	return msg.channel.createMessage("Pong! ")
		.then(m => {
			let diff = (Date.now() - start);
			return m.edit(`Pong! \`${diff}ms\``);
		});
  }
  if (! utils.messageIsOnMainServer(msg)) return;
  if (! msg.mentions.some(user => user.id === bot.user.id)) return;

  // If the person who mentioned the modmail bot is also on the modmail server, ignore them
  if (utils.getInboxGuild().members.get(msg.author.id)) return;

  // If the person who mentioned the bot is blocked, ignore them
  if (await blocked.isBlocked(msg.author.id)) return;

  bot.createMessage(utils.getLogChannel(bot).id, {
    content: `${utils.getInboxMention()}Bot mentioned in ${msg.channel.mention} by **${msg.author.username}#${msg.author.discriminator}**: "${msg.cleanContent}"`,
    disableEveryone: false,
  });
});

module.exports = {
  async start() {
    // Load modules
    console.log("Loading modules...");
    await reply(bot, sse);
    await purge(bot);
    await tags(bot);
    await command(bot);
    await close(bot, sse);
    await logs(bot);
    await block(bot);
    await move(bot);
    await snippets(bot);
    await suspend(bot);
    await notes(bot);
    await greeting(bot);
    await typingProxy(bot);
    await version(bot);
    await newthread(bot, sse);
    await idcmd(bot);
    await ping(bot);
    await fixAttachment(bot);
    await pull(bot);
    await restart(bot);
    await info(bot);

    // Connect to Discord
    console.log("Connecting to Discord...");
    await bot.connect();
  }
};
