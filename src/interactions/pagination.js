const Eris = require("eris");
const pagination = require("../utils/pagination");
const utils = require("../utils/utils");

module.exports = {
  name: "pagination",
  type: Eris.Constants.InteractionTypes.MESSAGE_COMPONENT,
  /**
   * @param {Eris.ComponentInteraction} interaction
   * @param {String} customID
   */
  handler: async (interaction, customID) => {
    const { message } = interaction;
    const page = pagination.get(message.id);
    if (! page) {
      throw new Error("Unknown pagination: " + message.id);
    }
    if (! (interaction.user || interaction.member).id !== page.authorID) return utils.postInteractionError(interaction,
      "Not Authorized",
      null,
      true
    );

    switch(customID) {
      case "next":
      case "prev": {
        page.index = customID === "prev" ? --page.index : ++page.index;
        break;
      }
      default: { // All custom defined custom IDs go here
        if (! page.extras || ! page.extras[customID]) {
          throw new Error(`Unknown pagination action ${customID}: ${message.id}`);
        }
        await page.extras[customID](interaction, page);
      }
    }

    clearTimeout(page.expire);

    // NOTE This is kinda jank but it's the best I can disabling page end buttons here
    if (page.index === 0) {
      message.components[0].components.find((a) => a.custom_id === "pagination:prev").disabled = true;
    }
    if (page.index + 1 === page.pages.length) {
      message.components[0].components.find((a) => a.custom_id === "pagination:next").disabled = true;
    }

    await page.onUpdate(interaction, page, page.pages[page.index]);
    page.expire = setTimeout(() => pagination.delete(interaction.message.id), 3e5);
  }
};
