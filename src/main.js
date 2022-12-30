const Eris = require("eris");
const SSE = require("express-sse");
const fs = require("fs");

const config = require("./config");
const bot = require("./bot");
const Queue = require("./utils/queue");
const utils = require("./utils/utils");
const blocked = require("./data/blocked");
const threads = require("./data/threads");

const reply = require("./modules/reply");
const alert = require("./modules/alert");
const role = require("./modules/role");
const purge = require("./modules/purge");
const close = require("./modules/close");
const snippets = require("./modules/snippets");
const logs = require("./modules/logs");
const hide = require("./modules/hide");
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
const exec = require("./modules/exec");
const restart = require("./modules/restart");
const info = require("./modules/info");
const setavatar = require("./modules/setavatar");
const dmlink = require("./modules/dmlink");
const stats = require("./modules/stats");
const say = require("./modules/say");
const modformat = require("./modules/modformat");
const joinLeave = require("./modules/joinLeaveNotification");

const attachments = require("./data/attachments");
const {ACCIDENTAL_THREAD_MESSAGES} = require("./utils/constants");
const { mainGuildId } = require("./config");

const messageQueue = new Queue();
const awaitingOpen = new Map();
// const redirectCooldown = new Map();
const interactionList = new Map();
const sse = new SSE();
let webInit = false;

// Once the bot has connected, set the bot status & activity
bot.on("ready", () => {
  bot.editStatus(null, {
    name: config.status,
    type: 0
  });

  console.log("Connected! Now listening to DMs.");

  const data = updateSSE();

  sse.updateInit({
    users: data.users,
    roles: data.roles,
    channels: data.channels
  });

  webserver(bot, sse);
  webInit = true;
});

bot.on("guildAvailable", guild => {
  if (guild.id !== config.mainGuildId) return;
  if (webInit === true) return;

  console.log("Registering main guild.");

  const data = updateSSE();

  sse.updateInit({
    users: data.users,
    roles: data.roles,
    channels: data.channels
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
  if (! msg.guildID || msg.author.bot) return;
  if (! (await utils.messageIsOnInboxServer(msg))) return;
  if (! utils.isStaff(msg.member) && ! utils.isCommunityTeam(msg.member)) return; // Only run if messages are sent by moderators (and now ct too) to avoid a ridiculous number of DB calls

  // Lance $ping command

  if (msg.author.id === "155037590859284481" && msg.content === "$ping") {
    let start = Date.now();
    return bot.createMessage(msg.channel.id, "Pong!")
      .then(m => {
        let diff = (Date.now() - start);
        return m.edit(`Pong! \`${diff}ms\``);
      });
  }

  const thread = await threads.findByChannelId(msg.channel.id);
  if (! thread) return;

  if (msg.content.startsWith(config.prefix) || msg.content.startsWith(config.snippetPrefix)) {
    // Save commands as "command messages"
    if (msg.content.startsWith(config.snippetPrefix)) return; // Ignore snippets
    thread.saveCommandMessage(msg, sse);
  } else if (config.alwaysReply) {
    // AUTO-REPLY: If config.alwaysReply is enabled, send all chat messages in thread channels as replies

    if (msg.attachments.length) await attachments.saveAttachmentsInMessage(msg);
    await thread.replyToUser(msg.member, msg.content.trim(), msg.attachments, config.alwaysReplyAnon, sse);
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
  if (msg.author.bot || ! (msg.type === 0 || msg.type === 19)) return; // Ignore bots & everything that isn't an actual message
  if (msg.guildID) return; // Ignore messages sent to a guild

  const isBlocked = await blocked.isBlocked(msg.author.id);

  if (isBlocked) return;
  if (msg.content.length > 1900) return bot.createMessage(msg.channel.id, `Your message is too long to be recieved by Dave. Please shorten it! (${msg.content.length}/1900)`);

  // Private message handling is queued so e.g. multiple message in quick succession don't result in multiple channels being created

  messageQueue.add(async () => {
    let thread = await threads.findOpenThreadByUserId(msg.author.id);

    // New thread
    if (! thread) {
      const opening = awaitingOpen.get(msg.channel.id);

      if (opening) {
        const timestamp = Date.now();

        if (timestamp - opening.timestamp > 300000) {
          awaitingOpen.delete(msg.channel.id);
        } else {
          if (timestamp - opening.lastWarning < 10000) return;

          opening.lastWarning = timestamp;
          awaitingOpen.set(msg.channel.id, opening);

          return bot.createMessage(msg.channel.id, "Please press one of the options provided before sending anymore messages!");
        }
      }

      // Ignore messages that shouldn't usually open new threads, such as "ok", "thanks", etc.

      if (config.ignoreAccidentalThreads && msg.content && ACCIDENTAL_THREAD_MESSAGES.includes(msg.content.trim().toLowerCase())) return;
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

      awaitingOpen.set(msg.channel.id, msg);

      const payload = {
        content: config.openingMessage,
        components: [{
          type: 1,
          components: [
            {
              type: 2,
              custom_id: "threadopen:support",
              style: 1,
              label: "Dyno Support"
            },
            {
              type: 2,
              custom_id: "threadopen:premium",
              style: 1,
              label: "Subscription/Payment Issues"
            },
            {
              type: 2,
              custom_id: "threadopen:moderation",
              style: 1,
              label: "Moderation Help"
            },
            {
              type: 2,
              custom_id: "threadopen:iWantStaff",
              style: 1,
              label: "Apply for Staff"
            },
            {
              type: 2,
              custom_id: "threadopen:noFuckingClue",
              style: 1,
              label: "Other"
            }
          ]
        }, {
          type: 1,
          components: [
            {
              type: 2,
              custom_id: "threadopen:cancel",
              style: 4,
              label: "Cancel Thread"
            }
          ]
        }]
      };

      return bot.createMessage(msg.channel.id, payload);
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
  if (! msg || ! msg.author || msg.author.bot) return;
  if (await blocked.isBlocked(msg.author.id)) return;

  // Old message content doesn't persist between bot restarts
  const oldContent = oldMessage && oldMessage.content || "*Unavailable due to bot restart*";
  const newContent = msg.content;

  // Ignore bogus edit events with no changes
  if (newContent.trim() === oldContent.trim()) return;

  // 1) Edit in DMs
  if (! msg.guildID) {
    const thread = await threads.findOpenThreadByUserId(msg.author.id);

    if (! thread) return;
    if (msg.content.length > 1900) return bot.createMessage(msg.channel.id, `Your edited message (<${utils.discordURL("@me", msg.channel.id, msg.id)}>) is too long to be recieved by Dave. (${msg.content.length}/1900)`);

    const oldThreadMessage = await thread.getThreadMessageFromDM(msg);
    const editMessage = `**EDITED <${utils.discordURL(mainGuildId, thread.channel_id, oldThreadMessage.thread_message_id)}>:**\n${newContent}`;
    const newThreadMessage = await thread.postSystemMessage(editMessage);

    thread.updateChatMessage(msg, newThreadMessage);
  }

  // 2) Edit in the thread
  else if ((await utils.messageIsOnInboxServer(msg)) && (utils.isStaff(msg.member) || utils.isCommunityTeam(msg.member))) {
    const thread = await threads.findOpenThreadByChannelId(msg.channel.id);
    if (! thread) return;

    thread.updateChatMessage(msg, msg);
  }
});

/**
 * When a staff message is deleted in a modmail thread, delete it from the database as well
 */
bot.on("messageDelete", async msg => {
  if (! msg.member) return; // Eris 0.15.0
  if (! utils.isStaff(msg.member) && ! utils.isCommunityTeam(msg.member)) return; // Only to prevent unnecessary DB calls, see first messageCreate event

  const thread = await threads.findOpenThreadByChannelId(msg.channel.id);
  if (! thread) return;

  deleteMessage(thread, msg);
});

/**
 * Bulk delete messages from the DB when a modmail thread is purged
 */
bot.on("messageDeleteBulk", async messages => {
  const {channel, member} = messages[0];

  if (! member) return;
  if (! utils.isStaff(member) && ! utils.isCommunityTeam(member)) return; // Same as above

  const thread = await threads.findOpenThreadByChannelId(channel.id);
  if (! thread) return;

  for (let msg of messages) {
    deleteMessage(thread, msg);
  }
});

/**
 * If a modmail thread is manually deleted, close the thread automatically
 */
bot.on("channelDelete", async (channel) => {
  if (! (channel instanceof Eris.TextChannel)) return;
  if (channel.guild.id !== config.mailGuildId) return;

  const thread = await threads.findOpenThreadByChannelId(channel.id);
  if (thread) {
    await thread.close(bot.user, false, sse);

    const logUrl = await thread.getLogUrl();
    utils.postLog(thread, bot.user, logUrl, "Thread channel deleted.");
  }
});

// NOTE New interaction handling. May or may not break

bot.on("interactionCreate", async (interaction) => {
  if (interaction.type !== 3 && interaction.type !== 5) {
    interaction.createMessage({
      content: "Unknown Interaction...please let a staff member know you recieved this error!",
      flags: 64
    });
    throw new Error("Unknown/unhandled interaction type: " + interaction.type);
  }

  const [interactionName, customID] = (interaction.data.values?.[0] || interaction.data.custom_id).split(":");

  if (! interactionName || ! customID) {
    interaction.createMessage({
      content: "Something went wrong...please try again or let a staff member know you recieved this error!",
      flags: 64
    });
    throw new Error("Invalid custom_id value: " + interaction.data.custom_id);
  }

  if (! interactionList.has(interactionName)) {
    interaction.createMessage({
      content: "Unknown Interaction Name...please try again or let a staff member know you recieved this error!",
      flags: 64
    });
    throw new Error("Unknown Interaction Name: " + interactionName);
  }

  const interact = interactionList.get(interactionName);
  if (Array.isArray(interact.type) ? ! interact.type.includes(interaction.type) : interact.type !== interaction.type) {
    interaction.createMessage({
      content: "Something went wrong...please try again or let a staff member know you recieved this error!",
      flags: 64
    });
    throw new Error(`Mismatched interaction type for ${interactionName}. Expected: ${interact.type}. Received ${interaction.type}`);
  }

  try {
    await interact.handler(interaction, customID, sse);
  } catch (error) {
    awaitingOpen.delete(interaction.message.channel.id); // In case an error occurs in DM, allows user to immediately send another message
    if (! interaction.acknowledged) {
      interaction.createMessage({
        content: "Something went wrong...please try again or let a staff member know you recieved this error!",
        flags: 64
      });
    } else {
      interaction.createFollowup({
        content: "Something went wrong...please try again or let a staff member know you recieved this error!",
        flags: 64
      });
    }
    throw error;
  }
});

/**
 * Create a new thread
 * @param {Eris.Interaction} interaction Response of the interaction
 * @param {Eris.Message} originalMsg Original object of the message sent to trigger the interactions to appear
 * @param {String} systemMsg The message which should first be sent when opening a new thread, before sending the users actual content
 * @param {String} clicked The button the user clicked (This will be removed in a future update, when it won't be needed anymore. For now, it's helpful to understand what button the user pressed)
 */
async function createThreadFromInteraction(interaction, originalMsg, systemMsg, clicked) {
  let thread;

  try {
    thread = await threads.createNewThreadForUser(originalMsg.author, clicked);
    if (! interaction.acknowledged) await interaction.acknowledge({
      type: 6
    });
  } catch (error) {
    if (error.code === 50035 && error.message.includes("words not allowed")) {
      utils.postErrorLog(`Tried to open a thread with ${originalMsg.author.username}#${originalMsg.author.discriminator} (${originalMsg.author.id}) but failed due to a restriction on channel names for servers in Server Discovery`);
      return interaction.createMessage("Thread was unable to be opened - please change your username and try again!");
    }
    utils.postErrorLog(`\`\`\`js\nError creating modmail channel for ${originalMsg.author.username}#${originalMsg.author.discriminator}!\n${error.stack}\n\`\`\``);
    return interaction.createMessage("Thread was unable to be opened due to an unknown error. If this persists, please contact a member of the staff team!");
  }

  sse.send({ thread }, "threadOpen");

  if (systemMsg) {
    await thread.postSystemMessage(systemMsg, true);
  }

  await thread.receiveUserReply(originalMsg, sse);
}

function updateSSE() {
  const data = { users: [], roles: [], channels: [] };
  const guild = bot.guilds.get(config.mainGuildId);

  if (guild) {
    for (let member of guild.members.values())
      data.users.push({ id: member.id, name: member.username, discrim: member.discriminator });

    for (let role of guild.roles.values())
      data.roles.push({ id: role.id, name: role.name, color: role.color });

    for (let channel of guild.channels.values())
      data.channels.push({ id: channel.id, name: channel.name });
  }

  return data;
}

function loadInteractions() {
  console.log("Loading interactions...");

  const dir = __dirname + "/./interactions";
  const list = fs.readdirSync(dir);

  for (let i of list) {
    const file = dir + "/" + i;

    if (! fs.statSync(file).isDirectory()) {
      i = require(file);

      if (! i.name || ! i.type || ! i.handler) {
        console.error(`Interaction ${i.name} needs a name, interaction type, and handler!`);
        continue;
      }

      if (interactionList.has(i.name)) {
        console.warn(`Interaction ${i.name} already registered!`);
        continue;
      }

      interactionList.set(i.name, i);
    }
  }
}

/**
 * @param {import('./data/Thread')} thread
 * @param {Eris.Message} msg
 */
async function deleteMessage(thread, msg) {
  if (! msg.author) return;
  if (msg.author.bot) return;
  if (! (await utils.messageIsOnInboxServer(msg))) return;
  if (! utils.isStaff(msg.member) && ! utils.isCommunityTeam(msg.member)) return;

  thread.deleteChatMessage(msg.id);
}

module.exports = {
  createThreadFromInteraction,
  awaitingOpen,
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
    close(bot, sse);
    snippets(bot);
    logs(bot);
    hide(bot);
    move(bot);
    block(bot);
    suspend(bot);
    greeting(bot);
    typingProxy(bot);
    version(bot);
    newthread(bot, sse);
    notes(bot);
    idcmd(bot);
    ping(bot);
    fixAttachment(bot);
    exec(bot);
    restart(bot);
    info(bot);
    setavatar(bot);
    dmlink(bot);
    stats(bot);
    say(bot);
    modformat(bot);
    joinLeave(bot);

    // Load interactions

    loadInteractions();
  }
};
