const Eris = require("eris");
const bot = require("./bot");
const moment = require("moment");
const publicIp = require("public-ip");
const attachments = require("./data/attachments");
const config = require("./config");

class BotError extends Error {}

const userMentionRegex = /^<@!?([0-9]+?)>$/;

let inboxGuild = null;
let mainGuild = null;
let logChannel = null;

/**
 * @returns {Promise<Eris.Guild>}
 */
async function getInboxGuild() {
  if (! inboxGuild) inboxGuild = bot.guilds.find(g => g.id === config.mailGuildId);
  if (! inboxGuild) inboxGuild = await bot.getRESTGuild(config.mailGuildId).catch(() => {});
  if (! inboxGuild) throw new BotError("The bot is not on the modmail (inbox) server!");
  return inboxGuild;
}

/**
 * @returns {Promise<Eris.Guild>}
 */
async function getMainGuild() {
  if (! mainGuild) mainGuild = bot.guilds.find(g => g.id === config.mainGuildId);
  if (! mainGuild) mainGuild = await bot.getRESTGuild(config.mainGuildId).catch(() => {});
  if (! mainGuild) console.warn("[WARN] The bot is not on the main server! If this is intentional, you can ignore this warning.");
  return mainGuild;
}

/**
 * Returns the designated log channel, or the default channel if none is set
 * @param bot
 * @returns {Promise<Eris.TextChannel>}
 */
async function getLogChannel() {
  const inboxGuild = await getInboxGuild();

  if (! config.logChannelId) {
    logChannel = inboxGuild.channels.get(inboxGuild.id);
  } else if (! logChannel) {
    logChannel = inboxGuild.channels.get(config.logChannelId);
  }

  if (! logChannel) {
    logChannel = await bot.getRESTChannel(config.logChannelId || inboxGuild.id).catch(() => {
      throw new BotError("Log channel not found!");
    });
  }

  return logChannel;
}

function postLog(...args) {
  getLogChannel().then(c => c.createMessage(...args));
}

function postError(str) {
  getLogChannel().then(c => c.createMessage({
    content: `${getInboxMention()}**Error:** ${str.trim()}`,
    disableEveryone: false
  }));
}

function handleError(error) {
  if (! bot.token.startsWith("Bot ")) bot.token = "Bot " + bot.token;
  if (! config.errorWebhookId || ! config.errorWebhookToken) {
    getLogChannel().then(c => c.createMessage("**Error:**\n"
    + `\`\`\`js\n${error.stack}\n\`\`\``));
    return;
  }
  bot.executeWebhook(config.errorWebhookId, config.errorWebhookToken, {
    content: "**Error:**\n"
      + `\`\`\`js\n${error.stack}\n\`\`\``
  }).catch(() => { // If no webhook configs are supplied, promise will be rejected
    getLogChannel().then(c => c.createMessage("**Error:**\n"
    + `\`\`\`js\n${error.stack}\n\`\`\``));
  });
}

/**
 * Returns whether the given member has permission to use modmail commands
 * @param member
 * @returns {boolean}
 */
function isStaff(member) {
  if (! config.inboxServerPermission) return true;
  if (! member) return false;
  return member.permissions.has(config.inboxServerPermission);
}

/**
 * Returns whether the given message is on the inbox server
 * @param msg
 * @returns {Promise<boolean>}
 */
async function messageIsOnInboxServer(msg) {
  if (! msg.channel.guild) return false;
  if (msg.channel.guild.id !== (await getInboxGuild()).id) return false;
  return true;
}

/**
 * Returns whether the given message is on the main server
 * @param msg
 * @returns {Promise<boolean>}
 */
async function messageIsOnMainServer(msg) {
  if (! msg.channel.guild) return false;
  if (msg.channel.guild.id !== (await getMainGuild()).id) return false;
  return true;
}

/**
 * @param attachment
 * @returns {Promise<string>}
 */
async function formatAttachment(attachment) {
  let filesize = attachment.size || 0;
  filesize /= 1024;

  const attachmentUrl = await attachments.getUrl(attachment.id, attachment.filename);
  return `**Attachment:** ${attachment.filename} (${filesize.toFixed(1)}KB)\n${attachmentUrl}`;
}

/**
 * Returns the user ID of the user mentioned in str, if any
 * @param {String} str
 * @returns {String|null}
 */
function getUserMention(str) {
  if (! str) return null;

  str = str.trim();

  if (str.match(/^[0-9]+$/)) {
    // User ID
    return str;
  } else {
    let mentionMatch = str.match(userMentionRegex);
    if (mentionMatch) return mentionMatch[1];
  }

  return null;
}

/**
 * Returns the current timestamp in an easily readable form
 * @returns {String}
 */
function getTimestamp(...momentArgs) {
  return moment.utc(...momentArgs).format("[Today] [at] hh:mm A");
}

/**
 * Disables link previews in the given string by wrapping links in < >
 * @param {String} str
 * @returns {String}
 */
function disableLinkPreviews(str) {
  return str.replace(/(^|[^<])(https?:\/\/\S+)/ig, "$1<$2>");
}

/**
 * Returns a URL to the bot's web server
 * @param {String} path
 * @returns {Promise<String>}
 */
async function getSelfUrl(path = "") {
  if (config.url) {
    return `${config.url}/${path}`;
  } else {
    const port = config.port || 8890;
    const ip = await publicIp.v4();
    return `http://${ip}:${port}/${path}`;
  }
}

/**
 * Returns the highest hoisted role of the given member
 * @param {Eris.Member} member
 * @returns {Eris.Role}
 */
function getMainRole(member) {
  const roles = member.roles.map(id => member.guild.roles.get(id));
  roles.sort((a, b) => a.position > b.position ? -1 : 1);
  return roles.find(r => r.hoist);
}

/**
 * Splits array items into chunks of the specified size
 * @param {Array} items
 * @param {Number} chunkSize
 * @returns {Array}
 */
function chunk(items, chunkSize) {
  const result = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    result.push(items.slice(i, i + chunkSize));
  }

  return result;
}

/**
 * Trims every line in the string
 * @param {String} str
 * @returns {String}
 */
function trimAll(str) {
  return str
    .split("\n")
    .map(str => str.trim())
    .join("\n");
}

/**
 * Turns a "delay string" such as "1h30m" to milliseconds
 * @param {String} str
 * @returns {Number}
 */
function convertDelayStringToMS(str) {
  const regex = /^([0-9]+)\s*([dhms])?[a-z]*\s*/;
  let match;
  let ms = 0;

  str = str.trim();

  while (str !== "" && (match = str.match(regex)) !== null) {
    if (match[2] === "d") ms += match[1] * 1000 * 60 * 60 * 24;
    else if (match[2] === "h") ms += match[1] * 1000 * 60 * 60;
    else if (match[2] === "m") ms += match[1] * 1000 * 60;
    else if (match[2] === "s" || ! match[2]) ms += match[1] * 1000;

    str = str.slice(match[0].length);
  }

  // Invalid delay string
  if (str !== "") {
    return null;
  }

  return ms;
}

function getInboxMention() {
  if (config.mentionRole == null) return "";
  else if (config.mentionRole === "here") return "@here ";
  else if (config.mentionRole === "everyone") return "@everyone ";
  else return `<@&${config.mentionRole}> `;
}

function postSystemMessageWithFallback(channel, thread, text) {
  if (thread) {
    thread.postSystemMessage(text);
  } else {
    channel.createMessage(text);
  }
}

/**
 * A normalized way to set props in data models, fixing some inconsistencies between different DB drivers in knex
 * @param {Object} target
 * @param {Object} props
 */
function setDataModelProps(target, props) {
  for (const prop in props) {
    if (! props.hasOwnProperty(prop)) continue;
    // DATETIME fields are always returned as Date objects in MySQL/MariaDB
    if (props[prop] instanceof Date) {
      // ...even when NULL, in which case the date's set to unix epoch
      if (props[prop].getUTCFullYear() === 1970) {
        target[prop] = null;
      } else {
        // Set the value as a string in the same format it's returned in SQLite
        target[prop] = moment.utc(props[prop]).format("YYYY-MM-DD HH:mm:ss");
      }
    } else {
      target[prop] = props[prop];
    }
  }
}

function regEscape(str) {
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function discordURL(guildID, channelID, messageID) {
  return `https://discord.com/channels/${guildID}/${channelID}/${messageID}`;
}

module.exports = {
  BotError,

  getInboxGuild,
  getMainGuild,
  getLogChannel,
  postError,
  postLog,
  handleError,

  isStaff,
  messageIsOnInboxServer,
  messageIsOnMainServer,

  formatAttachment,

  getUserMention,
  getTimestamp,
  disableLinkPreviews,
  getSelfUrl,
  getMainRole,
  convertDelayStringToMS,
  getInboxMention,
  postSystemMessageWithFallback,

  chunk,
  trimAll,

  setDataModelProps,

  regEscape,
  discordURL,
};
