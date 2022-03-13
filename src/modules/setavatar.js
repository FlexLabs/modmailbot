const Eris = require("eris");
const superagent = require("superagent");

const VALIDATE_IMG = /^http(s)?:\/\/[\w.-]+(?:\.[\w.-]+)+[\w\-._~:/?#[\]@!$&'()*+,;=.]+\.(?:png|jpg|gif|webp)$/;

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  bot.registerCommand("setavatar", async (msg, args) => {
    let url = args[0];
    if (! VALIDATE_IMG.test(url)) return bot.createMessage(msg.channel.id, "<:dynoError:696561633425621078> Invalid image URL");
    let response;
    try {
      response = await superagent.get(url).accept("image/*").responseType("arraybuffer");
    } catch (error) {
      if (error.response) { // Server responded with error
        return bot.createMessage(msg.channel.id, `<:dynoError:696561633425621078> Server responded with: ${error.status} ${error.message}\n${error.response.text || ""}`);
      } // Something happened with request
      return bot.createMessage(msg.channel.id, "<:dynoError:696561633425621078> Unable to send request: " + error.message);
    }
    const newav = `data:${response.headers["content-type"]};base64,${response.body.toString("base64")}`;
    return bot.editSelf({ avatar: newav }).then(
      () => bot.createMessage(msg.channel.id, "<:dynoSuccess:696561641227288639> Successfully changed avatar"),
      (e) => bot.createMessage(msg.channel.id, "<:dynoError:696561633425621078> Unable to change avatar: " + e)
    );
  }, {
    requirements: { // TODO Check if promisable void
      custom: (msg) => msg.member.roles.some((r) => ["203040224597508096", "523021576128692239"].includes(r))
    }
  });

  bot.registerCommandAlias("setav", "setavatar");
  bot.registerCommandAlias("av", "setavatar");
};
