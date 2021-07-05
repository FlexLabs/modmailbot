const transliterate = require("transliteration");
const moment = require("moment");
const uuid = require("uuid");
const Eris = require("eris");

const knex = require("../knex");
const config = require("../config");
const utils = require("../utils");

const { THREAD_STATUS } = require("./constants");

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
 * @param {Boolean} quiet If true, doesn't ping mentionRole or reply with responseMessage
 * @returns {Promise<Thread>}
 * @throws {Error}
 */
async function createNewThreadForUser(user, quiet = false) {
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
    created_at: moment.utc().format("YYYY-MM-DD HH:mm:ss")
  });

  const newThread = await findById(newThreadId);

  if (! quiet) {
    // Ping moderators of the new thread
    if (config.mentionRole) {
      await newThread.postNonLogMessage({
        content: `${utils.getInboxMention()}New modmail thread (${newThread.user_name})`,
      });
    }

    // Send auto-reply to the user
    if (config.responseMessage) {
      newThread.postToUser(config.responseMessage);
    }
  }

  await newThread.sendThreadInfo().catch((e) => process.emit("unhandledRejection", e));

  // Return the thread
  return newThread;
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
  createThreadInDB,
  getClosedThreadCountByUserId,
};

const Thread = require("./Thread");
