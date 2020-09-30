const path = require("path");

let userConfig;

try {
  userConfig = require("../config");
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
  "responseMessage": "Thank you for your message! Our mod team will reply to you here as soon as possible.",
  "ignoredWordResponse": "There are no commands. If you would like to speak with staff, please ask a question here.",
  "ignoredPrefixResponse": "There are no commands. If you would like to speak with staff, please ask a question here.",
  "genericResponse": "If you would like to speak with staff, please ask a question here.",

  "ignoredWords": [],
  "ignoredPrefixes": [],

  "ignoredWordAutorespond": false,
  "ignoredPrefixAutorespond": false,
  "ignoreNonAlphaMessages": false,

  "minContentLength": 3,

  "newThreadCategoryId": null,
  "mentionRole": "here",

  "inboxServerPermission": null,
  "inboxServerRoleId": null,
  "inboxAdminRoleId": null,
  "alwaysReply": false,
  "alwaysReplyAnon": false,
  "useNicknames": false,
  "ignoreAccidentalThreads": false,
  "threadTimestamps": false,
  "allowMove": false,
  "typingProxy": false,
  "typingProxyReverse": false,

  "allowedCategories": [],

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

for (const [prop, value] of Object.entries(userConfig)) {
  if (! defaultConfig.hasOwnProperty(prop)) {
    throw new Error(`Invalid option: ${prop}`);
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
