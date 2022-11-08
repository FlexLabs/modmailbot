const transliterate = require("transliteration");
const moment = require("moment");
const uuid = require("uuid");
const Eris = require("eris");

const knex = require("../knex");
const config = require("../config");
const utils = require("../utils/utils");

const { THREAD_STATUS } = require("../utils/constants");

/**
 * @param {String} id
 * @returns {Promise<Thread>}
 */
async function findById(id) {
  const thread = await knex("threads")
    .where("id", id)
    .first();

  return (thread ? new Thread(thread) : null);
}

/**
 * @param {String} userId
 * @returns {Promise<Thread>}
 */
async function findOpenThreadByUserId(userId) {
  const thread = await knex("threads")
    .where("user_id", userId)
    .where("status", THREAD_STATUS.OPEN)
    .first();


  return (thread ? new Thread(thread) : null);
}

/**
 * Creates a new modmail thread for the specified user
 * @param {Eris.User} user
 * @param {String} topic If the user opened the thread, this will be the label of which ever button they pressed
 * @param {Boolean} quiet If true, doesn't ping mentionRole or reply with responseMessage
 * @returns {Promise<Thread>}
 * @throws {Error}
 */
async function createNewThreadForUser(user, topic, quiet = false) {
  const existingThread = await findOpenThreadByUserId(user.id);
  if (existingThread) {
    throw new Error("Attempted to create a new thread for a user with an existing open thread!");
  }

  // Use the user's name+discrim for the thread channel's name
  // Channel names are particularly picky about what characters they allow, so we gotta do some clean-up
  let cleanName = transliterate.slugify(user.username);
  if (cleanName === "") cleanName = "unknown";
  cleanName = cleanName.slice(0, 95); // Make sure the discrim fits

  const channelName = `${cleanName}-${user.discriminator}`;

  console.log(`[NOTE] Creating new thread channel ${channelName}`);

  // Attempt to create the inbox channel for this thread
  const createdChannel = await utils.getInboxGuild().then(g => g.createChannel(channelName, 0, { reason: "New ModMail thread", parentID: config.newThreadCategoryId }));

  // Save the new thread in the database
  const newThreadId = await createThreadInDB({
    status: THREAD_STATUS.OPEN,
    user_id: user.id,
    user_name: `${user.username}#${user.discriminator}`,
    channel_id: createdChannel.id,
    created_at: moment.utc().format("YYYY-MM-DD HH:mm:ss"),
    topic: topic
  });

  const newThread = await findById(newThreadId);

  if (! quiet) {
    // Ping moderators of the new thread
    if (config.mentionRole) {
      await newThread.postNonLogMessage({
        content: `${utils.getInboxMention()}New modmail thread (${newThread.user_name})`,
      });
    }

    let contextMessage = "If you have screenshots or attachments to send, please do so now.";
    // Send auto-reply to the user
    if (topic === "Moderation Help" && config.responseMessage) {
      newThread.postToUser(config.responseMessage + "\n" + contextMessage);
    } else if (config.responseMessage) {
      newThread.postToUser(config.responseMessage);
    }
  }

  await newThread.sendThreadInfo(topic).catch((e) => process.emit("unhandledRejection", e));

  // Return the thread
  return newThread;
}

/**
 * Clear the current permission overwrites of a thread channel
 * @param {Eris.GuildTextableChannel} channel The channel object of the thread channel
 */
async function clearThreadOverwrites(channel) {
  const overwrites = channel.permissionOverwrites;
  if (! overwrites) return;
  let promises = [];
  for (let o of overwrites.values()) {
    if (o.id === channel.guild.id) continue;
    promises.push(channel.deletePermission(o.id, "Moving modmail thread."));
  }

  return await Promise.all(promises);
}

/**
 * Sync the permissions of a thread channel to the parent category
 * @param {Eris.GuildTextableChannel} channel The channel object of the thread channel
 * @param {Eris.CategoryChannel} category The parent category to sync permissions with
 */
function syncThreadChannel(channel, category) {
  const overwrites = category.permissionOverwrites;
  if (! overwrites) return;
  for (let o of overwrites.values()) {
    if (o.id === channel.guild.id) continue;
    channel.editPermission(o.id, o.allow, o.deny, o.type, "Moving modmail thread.");
  }
}

/**
 * Move a thread channel to a different category
 * @param {Thread} thread The thread object
 * @param {Eris.CategoryChannel} targetCategory The category to move the specified thread to
 * @param {Boolean | Array<String>} mentionRole Whether the bot should mention the adminMentionRole, or an array of role IDs to be pinged if supplied
 */
async function moveThread(thread, targetCategory, mentionRole) {
  const threadChannel = targetCategory.guild.channels.get(thread.channel_id);

  await clearThreadOverwrites(threadChannel);

  threadChannel.edit({
    parentID: targetCategory.id
  }).then(() => {
    syncThreadChannel(threadChannel, targetCategory);

    // Make thread private/unprivate
    if (targetCategory.id !== config.newThreadCategoryId && targetCategory.id !== config.communityThreadCategoryId) {
      thread.makePrivate();

      // Ping Admins if necessary
      if (Array.isArray(mentionRole)) {
        if (mentionRole.length !== 0) {
          threadChannel.createMessage({
            content: `${mentionRole.map((r) => `<@&${r}>`).join(" ")}, a thread has been moved.`,
            allowedMentions: {
              roles: true
            }
          });
        }
      } else if (config.adminMentionRole && mentionRole) {
        threadChannel.createMessage({
          content: `<@&${config.adminMentionRole}>, a thread has been moved.`,
          allowedMentions: {
            roles: true
          }
        });
      }
    } else {
      thread.makePublic();
    }
  });
}

/**
 * Creates a new thread row in the database
 * @param {Object} data
 * @returns {Promise<String>} The ID of the created thread
 */
async function createThreadInDB(data) {
  const threadId = uuid.v4();
  const now = moment.utc().format("YYYY-MM-DD HH:mm:ss");
  const finalData = Object.assign({created_at: now, is_legacy: 0}, data, {id: threadId});

  await knex("threads").insert(finalData);

  return threadId;
}

/**
 * @param {String} channelId
 * @returns {Promise<Thread>}
 */
async function findByChannelId(channelId) {
  const thread = await knex("threads")
    .where("channel_id", channelId)
    .first();

  return (thread ? new Thread(thread) : null);
}

/**
 * @param {String} channelId
 * @returns {Promise<Thread>}
 */
async function findOpenThreadByChannelId(channelId) {
  const thread = await knex("threads")
    .where("channel_id", channelId)
    .where("status", THREAD_STATUS.OPEN)
    .first();

  return (thread ? new Thread(thread) : null);
}

/**
 * @param {String} channelId
 * @returns {Promise<Thread>}
 */
async function findSuspendedThreadByChannelId(channelId) {
  const thread = await knex("threads")
    .where("channel_id", channelId)
    .where("status", THREAD_STATUS.SUSPENDED)
    .first();

  return (thread ? new Thread(thread) : null);
}

/**
 * @param {String} userId
 * @returns {Promise<Thread[]>}
 */
async function getClosedThreadsByUserId(userId) {
  const threads = await knex("threads")
    .where("status", THREAD_STATUS.CLOSED)
    .where("user_id", userId)
    .select();

  return threads.map(thread => new Thread(thread));
}

async function deleteClosedThreadsByUserId(userId) {
  await knex("threads")
    .where("status", THREAD_STATUS.CLOSED)
    .where("user_id", userId)
    .delete();
}

/**
 * @param {String} userId
 * @returns {Promise<number>}
 */
async function getClosedThreadCountByUserId(userId) {
  const row = await knex("threads")
    .where("status", THREAD_STATUS.CLOSED)
    .where("user_id", userId)
    .first(knex.raw("COUNT(id) AS thread_count"));

  return parseInt(row.thread_count, 10);
}

async function findOrCreateThreadForUser(user) {
  const existingThread = await findOpenThreadByUserId(user.id);
  if (existingThread) return existingThread;

  return createNewThreadForUser(user);
}

async function getThreadsThatShouldBeClosed() {
  const now = moment.utc().format("YYYY-MM-DD HH:mm:ss");
  const threads = await knex("threads")
    .where("status", THREAD_STATUS.OPEN)
    .whereNotNull("scheduled_close_at")
    .where("scheduled_close_at", "<=", now)
    .whereNotNull("scheduled_close_at")
    .select();

  return threads.map(thread => new Thread(thread));
}

module.exports = {
  findById,
  findOpenThreadByUserId,
  findByChannelId,
  findOpenThreadByChannelId,
  findSuspendedThreadByChannelId,
  createNewThreadForUser,
  getClosedThreadsByUserId,
  deleteClosedThreadsByUserId,
  findOrCreateThreadForUser,
  getThreadsThatShouldBeClosed,
  clearThreadOverwrites,
  syncThreadChannel,
  moveThread,
  createThreadInDB,
  getClosedThreadCountByUserId,
};

const Thread = require("./Thread");
