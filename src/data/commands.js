const db = require("../dynodb");

/**
 * @param {String} name
 * @returns {Promise<{ _id: any; name: string; _state: number; [s: string]: any; }>}
 */
async function getCommand(name) {
	return db.models.Command.findOne({ _state: 42, name }).lean();
}

module.exports = {
	getCommand,
};
