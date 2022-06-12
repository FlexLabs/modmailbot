const Eris = require("eris");
const moment = require("moment");
const publicIp = require("public-ip");
const bot = require("../bot");
const config = require("../config");
const attachments = require("../data/attachments");
const constants = require("./constants");

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
    allowedMentions: {
      everyone: false
    }
  }));
}

function handleError(error) {
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
 * Returns whether the given member has an administrator role
 * @param {Eris.Member} member
 * @returns {boolean}
 */
function isAdmin(member) {
  if (! config.inboxAdminRoleIDs.length) return false;
  if (! member) return false;
  return member.roles.some((r) => config.inboxAdminRoleIDs.includes(r));
}

/**
 * Returns whether the given member has permission to use modmail commands
 * @param {Eris.Member} member
 * @returns {boolean}
 */
function isStaff(member) {
  if (! config.inboxServerRoleIDs.length) return true;
  if (! member) return false;
  return member.roles.some((r) => config.inboxServerRoleIDs.includes(r));
}

/**
 * Returns whether the given member has permission to use some specific modmail commands
 * @param {Eris.Member} member
 * @returns {boolean}
 */
function isCommunityTeam(member) {
  if (! config.inboxCTRoleIDs.length) return true;
  if (! member) return false;
  return member.roles.some((r) => config.inboxCTRoleIDs.includes(r));
}

/**
 * Returns whether the given message is on the inbox server
 * @param {Eris.Message} msg
 * @returns {Promise<boolean>}
 */
async function messageIsOnInboxServer(msg) {
  if (! msg.guildID) return false;
  if (msg.guildID !== (await getInboxGuild()).id) return false;
  return true;
}

/**
 * Returns whether the given message is on the main server
 * @param {Eris.Message} msg
 * @returns {Promise<boolean>}
 */
async function messageIsOnMainServer(msg) {
  if (! msg.guildID) return false;
  if (msg.guildID !== (await getMainGuild()).id) return false;
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
 * Returns the color of the members' highest role which has a color
 * @param {Eris.Member} member
 */
function getUserRoleColor(member) {
  if (! member || ! member.roles) return 0;

  const roles = member.roles.map((r) => member.guild.roles.get(r)).sort((a, b) => b.position - a.position) || [];
  const colored = roles.filter((r) => r.color !== 0) || [];

  return colored[0] && colored[0].color;
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

function awaitPostSystemMessageWithFallback(channel, thread, text) {
  if (thread) {
    return thread.postSystemMessage(text);
  } else {
    return bot.createMessage(channel.id, text);
  }
}

/**
 * @param {Eris.GuildTextableChannel} channel
 * @param {import('./data/Thread')} thread
 * @param {Eris.MessageContent} text
 */
function postSystemMessageWithFallback(channel, thread, text) {
  awaitPostSystemMessageWithFallback(channel, thread, text);
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

function paginate(items, nPerPage) {
  if (! items || ! items.length) throw new RangeError("Expected an array with elements");

  const chunks = [[]];
  let index = 0;

  for (const i of items) {
    if (chunks[index].length >= nPerPage) {
      index++;
      chunks.push([]);
    }
    chunks[index].push(i);
  }

  return chunks;
}

/**
 * @param {String} text
 */
async function parseText(text) { // TODO Prevent circular references. Current setup is fine for now as nested inline snippets is not currently possible
  const matches = text.match(constants.INLINE_SNIPPET_REGEX); // Get text that should be converted
  if (! matches) return text;

  const fetched = await Promise.all(
    matches
      .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
      .map(async (m) => {
        const ret =  {
          word: m.replace(constants.REMOVE_INLINE_BRACKETS, ""),
          full: m
        };

        let snippet = await snippets.get(ret.word);
        snippet = snippet && snippet.body;
        ret.content = snippet;
        return ret;
      })
  );

  const noMatch = fetched.filter((s) => ! s.content);
  if (noMatch.length) {
    const error = new Error("UNKNOWN_SNIPPETS");
    error.matches = noMatch.map((m) => m.word);
    throw error;
  }

  let toReturn = text;
  for (const s of fetched) {
    toReturn = toReturn.replace(RegExp("(?<!\\\\)" + s.full, "g"), s.content);
  }
  return toReturn;
}

module.exports = {
  BotError,

  getInboxGuild,
  getMainGuild,
  getLogChannel,
  postError,
  postLog,
  handleError,

  isAdmin,
  isStaff,
  isCommunityTeam,
  messageIsOnInboxServer,
  messageIsOnMainServer,

  formatAttachment,

  getUserMention,
  getUserRoleColor,
  getTimestamp,
  disableLinkPreviews,
  getSelfUrl,
  convertDelayStringToMS,
  getInboxMention,
  postSystemMessageWithFallback,
  awaitPostSystemMessageWithFallback,

  chunk,
  trimAll,

  setDataModelProps,

  regEscape,
  discordURL,
  paginate,
  parseText
};

const snippets = require("../data/snippets");
