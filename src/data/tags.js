const db = require("../dynodb");

/**
 * @typedef TagLean
 * @property {any} _id
 * @property {String} guild
 * @property {{ [s: string]: any; }} author
 * @property {String} tag
 * @property {String} content
 * @property {Number} usage
 * @property {Date} createdAt
 */

 /**
	* @param {String} guildId
	* @param {String} tag
	* @returns {Promise<TagLean>}
	*/
async function getTag(guildId, tag) {
	return db.models.Tag.findOne({ guild: guildId, tag }).lean();
}

module.exports = {
	getTag,
};
