/**
 * These component objects are used during the process of reporting a user, and
 * requesting help with subscriptions/payments!
 */
const confirmClose = [{
  type: 1,
  components: [{
    type: 3,
    custom_id: "thread:confirmClose",
    placeholder: "Select a time to schedule close",
    options: [
      {
        label: "Close in 10mins",
        value: "thread:closeIn10m",
        emoji: {
          name: "DaveHangUp",
          id: "815830349816659968",
        }
      },
      {
        label: "Close in 15mins",
        value: "thread:closeIn15m",
        emoji: {
          name: "DaveHangUp",
          id: "815830349816659968",
        }
      },
      {
        label: "Close in 30mins",
        value: "thread:closeIn30m",
        emoji: {
          name: "DaveHangUp",
          id: "815830349816659968",
        }
      },
      {
        label: "Close in 1hr",
        value: "thread:closeIn1h",
        emoji: {
          name: "DaveHangUp",
          id: "815830349816659968",
        }
      },
      {
        label: "Close in 24hrs",
        value: "thread:closeIn24h",
        emoji: {
          name: "DaveHangUp",
          id: "815830349816659968",
        }
      },
      {
        label: "Close in π",
        value: "thread:close314",
        emoji: {
          name: "DaveHangUp",
          id: "815830349816659968",
        }
      }
    ]
  }]
}];

const cancelClose = [{
  type: 1,
  components: [
    {
      type: 2,
      style: 3,
      label: "Cancel Close",
      emoji: {
        name: "DaveThinking",
        id: "796834960706502676"
      },
      custom_id: "thread:cancelClose"
    }
  ]
}];

const cancelSuspend = [{
  type: 1,
  components: [
    {
      type: 2,
      style: 3,
      label: "Unsuspend",
      emoji: {
        name: "DaveThinking",
        id: "796834960706502676"
      },
      custom_id: "thread:cancelSuspend"
    }
  ]
}];

const internalLeave = [{
  type: 1,
  components: [
    {
      type: 2,
      style: 4,
      label: "Close",
      emoji: {
        name: "DaveHangUp",
        id: "815830349816659968"
      },
      custom_id: "thread:closeIn10m"
    },
    {
      type: 2,
      style: 2,
      label: "Suspend",
      emoji: {
        name: "DaveHangUp",
        id: "815830349816659968"
      },
      custom_id: "thread:suspend"
    }
  ]
}];

const internalButtons = [{
  type: 1,
  components: [
    {
      type: 2,
      style: 2,
      label: "Send UserID",
      emoji: {
        name: "DaveRing",
        id: "815827221549154355"
      },
      custom_id: "thread:sendUserId"
    },
    {
      type: 2,
      style: 1,
      label: "Greetings",
      emoji: {
        name: "DaveEgg",
        id: "698046132605157396"
      },
      custom_id: "thread:greetings"
    },
    {
      type: 2,
      style: 1,
      label: "Redirect to Support",
      emoji: {
        name: "DaveDerp",
        id: "687013677681213484"
      },
      custom_id: "thread:redirectSupport"
    },
    {
      type: 2,
      style: 1,
      label: "Move",
      emoji: {
        name: "DaveBanana",
        id: "752731353266520084"
      },
      custom_id: "thread:moveThread"
    },
    {
      type: 2,
      style: 4,
      label: "Block",
      emoji: {
        name: "DaveCult",
        id: "827253899403722803"
      },
      custom_id: "thread:blockUser"
    }
  ]
}];

const greetingMenu = [{
  type: 1,
  components: [{
    type: 2,
    style: 1,
    label: "Help",
    custom_id: "thread:greeting1"
  },
  {
    type: 2,
    style: 1,
    label: "Not4This",
    custom_id: "thread:greeting2"
  },
  {
    type: 2,
    style: 1,
    label: "Moving",
    custom_id: "thread:greeting3"
  },
  {
    type: 2,
    style: 1,
    label: "Transfer",
    custom_id: "thread:greeting4"
  },
  {
    type: 2,
    style: 1,
    label: "ReportInfo",
    custom_id: "thread:greeting5"
  },
  ]
},
{
  type: 1,
  components: [
    {
      type: 2,
      style: 1,
      label: "DiscordReport",
      custom_id: "thread:greeting6"
    },
    {
      type: 2,
      style: 1,
      label: "DMAds",
      custom_id: "thread:greeting7"
    },
    {
      type: 2,
      style: 1,
      label: "Appeal",
      custom_id: "thread:greeting8"
    },
    {
      type: 2,
      style: 1,
      label: "Lockdown",
      custom_id: "thread:greeting9"
    },
    {
      type: 2,
      style: 1,
      label: "Status",
      custom_id: "thread:greeting10"
    },
  ]
}
];

const moveMenu = [{
  type: 1,
  components: [
    {
      type: 2,
      style: 2,
      label: "Council & Ping",
      emoji: {
        name: "report",
        id: "986073682952716349"
      },
      custom_id: "movethread:council-ping"
    },
    {
      type: 2,
      style: 2,
      label: "Council",
      custom_id: "movethread:council"
    },
    {
      type: 2,
      style: 2,
      label: "Community",
      custom_id: "movethread:community"
    },
    {
      type: 2,
      style: 2,
      label: "ModMail",
      custom_id: "movethread:modmail"
    },
    {
      type: 2,
      style: 4,
      label: "Cancel",
      custom_id: "movethread:cancel"
    }
  ]
}];

const blockUserModal = {
  title: "Block User!",
  custom_id: "blockuser:block",
  components: [{
    type: 1,
    components: [
      {
        type: 4,
        custom_id: "reason",
        style: 2,
        label: "Reason",
        min_length: 1,
        max_length: 1000,
        placeholder: "Please enter a reason!"
      }
    ]
  }]
};

const reportUserModal = {
  title: "Report User!",
  custom_id: "threadopen:userReport",
  components: [
    {
      type: 1,
      components: [{
        type: 4,
        custom_id: "userID",
        style: 1,
        label: "User ID/Name",
        min_length: 1,
        max_length: 32,
        placeholder: "Please enter a user ID!"
      }]
    },
    {
      type: 1,
      components: [{
        type: 4,
        custom_id: "reason",
        style: 2,
        label: "Reason",
        min_length: 1,
        max_length: 1000,
        placeholder: "Please enter a reason!"
      }]
    },
    {
      type: 1,
      components: [{
        type: 4,
        custom_id: "context",
        style: 2,
        label: "Additional Context/Links (Optional)",
        max_length: 1000,
        required: false,
        placeholder: "Add any additional information here, and any message links we can use for reference."
      }]
    }
  ]
};

const moderationHelpReasons = [{
  type: 1,
  components: [
    {
      type: 3,
      custom_id: "threadopenmoderation:moderationHelpReasons",
      options: [
        {
          "label": "Report a User",
          "value": "threadopenmoderation:reportUser"
        },
        {
          "label": "Report Dyno Impersonation",
          "value": "threadopenmoderation:dynoImp"
        },
        {
          "label": "Appeal a Ban",
          "value": "threadopenmoderation:banAppeal"
        },
        {
          "label": "Appeal a Mute",
          "value": "threadopenmoderation:muteAppeal"
        },
        {
          "label": "Other",
          "value": "threadopenmoderation:idfk",
          "desription": "Your issue isn't listed here? Open a thread and explain further."
        },
        {
          "label": "Cancel",
          "value": "threadopenmoderation:cancel",
          "description": "Cancel opening a modmail thread"
        }
      ],
      min_values: 1,
      max_values: 1,
      placeholder: "What do you need help with?"
    }
  ]
}];

module.exports = {
  confirmClose,
  internalLeave,
  cancelClose,
  cancelSuspend,
  internalButtons,
  greetingMenu,
  moveMenu,
  blockUserModal,
  reportUserModal,
  moderationHelpReasons
};
