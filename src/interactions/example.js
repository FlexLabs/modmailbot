/* eslint-disable no-unused-vars */
// This is an example of an interaction handler.

const Eris = require("eris");

module.exports = {
  name: "example", // When filling out custom IDs, they MUST be written in the format name:custom_id, e.g. example:loadMessage. Failing to do so will result in an interaction error
  type: Eris.Constants.InteractionTypes.MESSAGE_COMPONENT, // Validation for interaction type. This will be used to distinguish message component interactions and modal submit interactions
  handler: (interaction, customID) => { // Due to the way the handler works, customID is provided without the interaction name, i.e. customID would be loadMessage if it was using the above example
    interaction.acknowledge(); // Everything in here is as normal
  }
};
