const path = require("path");

let localConfig;
let ghConfig;

try {
  localConfig = require("../config");
  ghConfig = require("../config2");
} catch (e) {
  throw new Error(`Config file could not be found or read! The error given was: ${e.message}`);
}

const defaultConfig = {
  "token": null,
  "mailGuildId": null,
  "mainGuildId": null,
  "logChannelId": null,
  "errorWebhookId": null,
  "errorWebhookToken": null,

  "prefix": "!",
  "snippetPrefix": "!!",

  "replyAnonDefault": false,
  "snippetAnonDefault": false,

  "status": "Message me for help!",
  "openingMessage": "Hi there, thanks for reaching out to the Dyno modmail bot. This is the best way to get in contact with the Dyno staff team. Please select what you'd like assistance with from the options below so I can route your request to the correct team.\n\n*Note: We can only offer assistance in English.*",
  "responseMessage": "Your message has been forwarded to our staff team. A staff member will reply to you here as soon as possible.",
  "dynoSupportMessage": "We offer Dyno support in the server in the following channels:\n<#991748447046729858> | FAQ and help from Support Team members\n<#240777175802839040> | Support from community members\n<#395821744696590338> | Soutien en français\n<#395821762669051904> | Internationale Unterstützung / Suporte internacional / Apoyo internacional / Uluslararası destek / الدعم الدولي",
  "dynoPremiumSupport": "\n\n<:DynoBravo:556614157777109023> As you are a premium user, you can also create a ticket post in <#1028319963703951481> for pressing issues!",
  "newThreadCategoryId": null,
  "communityThreadCategoryId": null,
  "adminThreadCategoryId": null,
  "mentionRole": "here",
  "adminMentionRole": null,

  "inboxServerRoleIDs": [],
  "inboxCTRoleIDs": [],
  "inboxAdminRoleIDs": [],
  "alwaysReply": false,
  "alwaysReplyAnon": false,
  "useNicknames": false,
  "ignoreAccidentalThreads": false,
  "threadTimestamps": false,
  "allowMove": false,
  "typingProxy": false,
  "typingProxyReverse": false,

  "allowedCategories": [],
  "modmailCategories": {},

  "autoResponses": [],

  "enableGreeting": false,
  "greetingMessage": null,
  "greetingAttachment": null,

  "relaySmallAttachmentsAsAttachments": false,

  "port": 8890,
  "url": null,
  "https": null,

  "mongoDSN": null,

  "dbDir": path.join(__dirname, "..", "db"),
  "knex": null,

  "logDir": path.join(__dirname, "..", "logs"),

  "dataFactory": false,

  "dashAuthRoles": null,
  "dashAuthUsers": null,
  "clientId": null,
  "clientSecret": null,
  "redirectPath": "/login",
};

const required = ["token", "mailGuildId", "mainGuildId", "logChannelId"];
const requiredAuth = ["clientId", "clientSecret", "redirectPath"];
const finalConfig = Object.assign({}, defaultConfig);

for (const [prop, value] of Object.entries(localConfig)) {
  if (! defaultConfig.hasOwnProperty(prop)) {
    continue;
  }

  finalConfig[prop] = value;
}

for (const [prop, value] of Object.entries(ghConfig)) {
  // Protect local only values, just in case
  if (["token", "port", "url", "clientId", "clientSecret", "mongoDSN"].includes(prop)) {
    continue;
  }

  if (! defaultConfig.hasOwnProperty(prop)) {
    //throw new Error(`Invalid option: ${prop}`);
  }

  finalConfig[prop] = value;
}

if (! finalConfig["knex"]) {
  finalConfig["knex"] = {
    client: "sqlite",
    connection: {
      filename: path.join(finalConfig.dbDir, "data.sqlite")
    },
    useNullAsDefault: true
  };
}

Object.assign(finalConfig["knex"], {
  migrations: {
    directory: path.join(finalConfig.dbDir, "migrations")
  }
});

for (const opt of required) {
  if (! finalConfig[opt]) {
    console.error(`Missing required config.json value: ${opt}`);
    process.exit(1);
  }
}

if (finalConfig.dashAuthRoles || finalConfig.dashAuthUsers) {
  let missingAuth = requiredAuth.filter(opt => ! finalConfig[opt]);
  if (missingAuth.length) {
    console.error(`Missing settings required by "dashAuth": ${missingAuth.join(" ")}`);
    process.exit(1);
  }
}

module.exports = finalConfig;
