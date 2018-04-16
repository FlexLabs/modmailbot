const db = require('../dynodb');

async function getTag(guildId, tag) {
	return await db.models.Tag.findOne({ guild: guildId, tag }).lean();
}

module.exports = {
	getTag,
};
