const Eris = require("eris");
const SSE = require("express-sse");

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

const attachments = require("./data/attachments");
const components = require("./utils/components");
const {ACCIDENTAL_THREAD_MESSAGES} = require("./utils/constants");
const { mainGuildId } = require("./config");

const messageQueue = new Queue();
const awaitingOpen = new Map();
const redirectCooldown = new Map();
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
  if (! msg.guildID || msg.author.bot) return;
  if (! (await utils.messageIsOnInboxServer(msg))) return;
  if (! utils.isStaff(msg.member)) return; // Only run if messages are sent by moderators to avoid a ridiculous number of DB calls

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
  if (msg.author.bot || msg.type !== 0) return; // Ignore bots & pins
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
              custom_id: "dynoSupport",
              style: 1,
              label: "Dyno Support"
            },
            {
              type: 2,
              custom_id: "premiumSupport",
              style: 1,
              label: "Premium/Payment Issues"
            },
            {
              type: 2,
              custom_id: "reportUser",
              style: 1,
              label: "Report a User"
            },
            {
              type: 2,
              custom_id: "noFuckingClue",
              style: 1,
              label: "Other"
            },
            {
              type: 2,
              custom_id: "cancelThread",
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
  else if ((await utils.messageIsOnInboxServer(msg)) && utils.isStaff(msg.member)) {
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

/**
 * When a staff member uses an internal button...
 * 1) Find an open thread where the interaction originated from
 * 2) If found, check the custom ID and send any applicable events/messages
 * NOTE: This event manages everything in regards to the internal staff buttons, including when they're pressed and when a staff member blocks the user with the buttons
 */
bot.on("interactionCreate", async (interaction) => {
  if (! interaction || ! interaction.data || ! interaction.guildID) return;

  const { message } = interaction;
  const thread = await threads.findByChannelId(message.channel.id);

  if (! thread) return;

  const customID = interaction.data.custom_id;

  // Thread redirection confirmation

  if (components.moveToAdmins[0].components.map((c) => c.custom_id).includes(customID)) {
    bot.editMessage(message.channel.id, message.id, {
      content: message.content,
      components: [{
        type: 1,
        components: message.components[0].components.map((c) => {
          c.disabled = true;
          c.style = c.custom_id === customID ? 1 : 2;
          return c;
        })
      }]
    });

    if (message.channel.id === config.adminThreadCategoryId) return interaction.acknowledge();
    if (customID.endsWith("Cancel")) {
      return interaction.createMessage("Cancelled thread transfer.");
    } else {
      const targetCategory = message.channel.guild.channels.get(config.adminThreadCategoryId);

      if (! targetCategory || ! config.allowedCategories.includes(targetCategory.id)) {
        return interaction.createMessage("I can't move this thread to the admin category because it doesn't exist, or I'm not allowed to move threads there.");
      }

      return threads.moveThread(thread, targetCategory, customID.endsWith("-ping"))
        .then(() => interaction.acknowledge())
        .catch((err) => {
          utils.handleError(err);
          interaction.createMessage("Something went wrong while attempting to move that thread.");
        });
    }
  }

  // All other buttons

  switch (customID) {
    case "sendUserID": {
      interaction.createMessage({
        content: thread.user_id,
        flags: 64
      });
      break;
    }
    case "sendThreadID": {
      interaction.createMessage({
        content: thread.id,
        flags: 64
      });
      break;
    }
    case "redirectAdmins": {
      const targetCategory = message.channel.guild.channels.get(config.adminThreadCategoryId);

      if (! targetCategory || ! config.allowedCategories.includes(targetCategory.id)) {
        return interaction.createMessage("I can't move this thread to the admin category because it doesn't exist, or I'm not allowed to move threads there.");
      }

      if (message.channel.parentID === targetCategory.id) {
        return interaction.createMessage(`This thread is already inside of the ${targetCategory.name} category.`);
      }

      interaction.createMessage({
        content: `Are you sure you want to move this thread to ${targetCategory.name}?`,
        components: components.moveToAdmins
      });
      break;
    }
    case "redirectSupport": {
      const cooldown = redirectCooldown.get(thread.id);

      if (cooldown && Date.now () - cooldown.timestamp < 10000) {
        interaction.createMessage({
          content: (cooldown.member.id === interaction.member.id ? "You've" : `<@${cooldown.member.id}>`) + " only just redirected this user to the support channels.",
          flags: 64
        });
      } else {
        interaction.acknowledge();
        thread.replyToUser(interaction.member, config.dynoSupportMessage, [], config.replyAnonDefault);
        redirectCooldown.set(thread.id, {
          member: interaction.member,
          timestamp: Date.now()
        });
      }
      break;
    }
    case "blockUser": {
      const isBlocked = await blocked.isBlocked(thread.user_id);

      if (isBlocked) {
        interaction.createMessage({
          content: `${thread.user_name} is already blocked!`,
          flags: 64
        });
        break;
      }

      const modal = components.blockUserModal;

      if (thread.user_name) {
        modal.title = `Block ${thread.user_name}!`;
      }

      bot.createInteractionResponse(interaction.id, interaction.token, {
        type: 9,
        data: modal
      });
      break;
    }
    case components.blockUserModal.custom_id: {
      const isBlocked = await blocked.isBlocked(thread.user_id);

      if (isBlocked) {
        interaction.createMessage({
          content: `${thread.user_name} is already blocked!`,
          flags: 64
        });
        break;
      }

      const reason = interaction.data.components[0].components[0].value;
      const moderator = interaction.member;

      await thread.replyToUser(moderator, `You have been blocked for ${reason}`, [], config.replyAnonDefault);
      await blocked.block(thread.user_id, thread.user_name, moderator.id)
        .then(() => {
          blocked.logBlock({
            id: thread.user_id,
            username: thread.user_name.split("#")[0],
            discriminator: thread.user_name.split("#")[1]
          }, moderator, reason);
          interaction.createMessage({
            content: `Blocked <@${thread.user_id}> (${thread.user_id}) from modmail!`,
            flags: 64
          });
        });
      break;
    }
    default: interaction.createMessage({
      content: "Something's wrong. Please mention a Dave contributor!",
      flags: 64
    });
  }
});

/**
 * When a private button gets pressed...
 * 1) Edit the button to disable all the buttons
 * 2) Respond to their message or simply open a thread, depending on which button got pressed
 */
bot.on("interactionCreate", async (interaction) => {
  if (! interaction || ! interaction.data || interaction.guildID) return;

  const { message } = interaction;
  const customID = interaction.data.custom_id;
  const opening = awaitingOpen.get(message.channel.id);

  if (! opening || Date.now() - opening.timestamp > 300000) return;

  bot.editMessage(message.channel.id, message.id, {
    content: message.content,
    components: [{
      type: 1,
      components: message.components[0].components.map((c) => {
        c.disabled = true;
        c.style = c.custom_id === customID ? 1 : 2;
        return c;
      })
    }]
  });

  if (customID === "cancelThread") {
    interaction.createMessage("Cancelled thread, your message won't be forwarded to staff members.");
  } else if (customID === "dynoSupport") {
    interaction.createMessage(config.dynoSupportMessage);
  } else {
    let thread;
    let clicked = message.components[0].components.find((c) => c.custom_id === customID);

    try {
      thread = await threads.createNewThreadForUser(opening.author, clicked.label);
      await interaction.acknowledge();
    } catch (error) {
      awaitingOpen.delete(message.channel.id);
      if (error.code === 50035 && error.message.includes("words not allowed")) {
        utils.postLog(`Tried to open a thread with ${opening.author.username}#${opening.author.discriminator} (${opening.author.id}) but failed due to a restriction on channel names for servers in Server Discovery`);
        return interaction.createMessage("Thread was unable to be opened - please change your username and try again!");
      }
      utils.postLog(`**Error:** \`\`\`js\nError creating modmail channel for ${opening.author.username}#${opening.author.discriminator}!\n${error.stack}\n\`\`\``);
      return interaction.createMessage("Thread was unable to be opened due to an unknown error. If this persists, please contact a member of the staff team!");
    }

    sse.send({ thread }, "threadOpen");
    await thread.receiveUserReply(opening, sse);
  }

  awaitingOpen.delete(message.channel.id);
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
  }
};
