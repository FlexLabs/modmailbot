const Eris = require("eris");
const moment = require("moment");
const knex = require("../knex");
const utils = require("../utils/utils");

/**
 * Checks whether userId is blocked
 * @param {String} userId
 * @returns {Promise<Boolean>}
 */
async function isBlocked(userId) {
  const row = await knex("blocked_users")
    .where("user_id", userId)
    .first();

  return !! row;
}

/**
 * Blocks the given userId
 * @param {String} userId
 * @param {String} userName
 * @param {String} blockedBy
 * @returns {Promise<number[]>}
 */
async function block(userId, userName = "", blockedBy = null) {
  if (await isBlocked(userId)) return;

  return knex("blocked_users")
    .insert({
      user_id: userId,
      user_name: userName,
      blocked_by: blockedBy,
      blocked_at: moment.utc().format("YYYY-MM-DD HH:mm:ss")
    });
}

/**
 * Unblocks the given userId
 * @param {String} userId
 * @returns {Promise<number>}
 */
async function unblock(userId) {
  return knex("blocked_users")
    .where("user_id", userId)
    .delete();
}

/**
 * Logs the block/unblock to the logging channel
 * @param {Eris.User} user
 * @param {Eris.Member} moderator
 * @param {String} reason
 * @param {Boolean} isUnblock
 */
function logBlock(user, moderator, reason, isUnblock = false) {
  const logData = {
    embed: {
      author: {name: `${isUnblock ? "Unblock" : "Block"} | ${user.username}#${user.discriminator}`},
      color: isUnblock ? 0x43B582 : 0xF04947,
      timestamp: new Date(),
      footer: {text: `UserID: ${user.id}`},
      fields: [
        {name: "User", value: `${user.mention}`, inline: true},
        {name: "Moderator", value: `${moderator.mention}`, inline: true},
        {name: "Reason", value: `${reason ?? "No Reason Given"}`, inline: true}
      ]
    }
  };

  utils.getLogChannel().then(c => c.createMessage(logData));
}

module.exports = {
  isBlocked,
  block,
  unblock,
  logBlock
};
